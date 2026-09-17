#include "printer_driver.h"
#include "version.h"
#include "config_store.h"
#include "token_manager.h"
#include "print_template.h"
#include "paper_estimator.h"
#include "event_log.h"
#include <HardwareSerial.h>
#include <time.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/semphr.h>

// ESC/POS command bytes
#define ESC  0x1B
#define GS   0x1D
#define LF   0x0A

static HardwareSerial   s_uart(PRINTER_UART_NUM);
static QueueHandle_t    s_queue     = nullptr;
static volatile PrinterState s_state = PrinterState::IDLE;
static SemaphoreHandle_t s_stateMtx = nullptr;

// ---------------------------------------------------------------------------
// Low-level ESC/POS write helpers
// ---------------------------------------------------------------------------

static void writeBytes(const uint8_t* data, size_t len) {
    s_uart.write(data, len);
}

static void writeByte(uint8_t b) {
    s_uart.write(b);
}

namespace PrinterDriver {

void begin() {
    s_stateMtx = xSemaphoreCreateMutex();
    s_queue     = xQueueCreate(4, sizeof(PrintRequest));

    s_uart.begin(PRINTER_BAUD_RATE, SERIAL_8N1,
                 PIN_PRINTER_RX,   // ESP32-C3 RX ← Printer TX
                 PIN_PRINTER_TX);  // ESP32-C3 TX → Printer RX

    vTaskDelay(pdMS_TO_TICKS(200)); // Let printer warm up
    escInitAndReset();
}

QueueHandle_t queue() { return s_queue; }

bool isBusy() {
    xSemaphoreTake(s_stateMtx, portMAX_DELAY);
    bool busy = (s_state == PrinterState::PRINTING);
    xSemaphoreGive(s_stateMtx);
    return busy;
}

PrinterState state() {
    xSemaphoreTake(s_stateMtx, portMAX_DELAY);
    PrinterState st = s_state;
    xSemaphoreGive(s_stateMtx);
    return st;
}

static void setState(PrinterState st) {
    xSemaphoreTake(s_stateMtx, portMAX_DELAY);
    s_state = st;
    xSemaphoreGive(s_stateMtx);
}

bool enqueue(const PrintRequest& req) {
    if (!s_queue) return false;
    return xQueueSend(s_queue, &req, pdMS_TO_TICKS(100)) == pdTRUE;
}

// ---------------------------------------------------------------------------
// ESC/POS command implementations
// ---------------------------------------------------------------------------

void escInitAndReset() {
    const uint8_t cmd[] = { ESC, '@' };
    writeBytes(cmd, sizeof(cmd));
    vTaskDelay(pdMS_TO_TICKS(50));
}

void escReset() { escInitAndReset(); }

void escBold(bool on) {
    const uint8_t cmd[] = { ESC, 'E', (uint8_t)(on ? 1 : 0) };
    writeBytes(cmd, sizeof(cmd));
}

void escDoubleHeight(bool on) {
    uint8_t mode = on ? 0x10 : 0x00;
    const uint8_t cmd[] = { ESC, '!', mode };
    writeBytes(cmd, sizeof(cmd));
}

void escDoubleWidth(bool on) {
    uint8_t mode = on ? 0x20 : 0x00;
    const uint8_t cmd[] = { ESC, '!', mode };
    writeBytes(cmd, sizeof(cmd));
}

void escAlign(uint8_t align) {
    const uint8_t cmd[] = { ESC, 'a', align };
    writeBytes(cmd, sizeof(cmd));
}

void escFeedLines(uint8_t n) {
    const uint8_t cmd[] = { ESC, 'd', n };
    writeBytes(cmd, sizeof(cmd));
}

void escCut() {
    const uint8_t cmd[] = { GS, 'V', 0x42, 0x00 };
    writeBytes(cmd, sizeof(cmd));
    vTaskDelay(pdMS_TO_TICKS(300)); // Allow cut to complete
}

void escPrintText(const char* text) {
    if (!text) return;
    s_uart.print(text);
    writeByte(LF);
}

void escPrintQR(const char* data, uint8_t size) {
    if (!data) return;
    size_t dataLen = strlen(data);
    uint16_t pLen  = (uint16_t)(dataLen + 3);

    // QR model: GS ( k pL pH cn fn n
    // Set model 2
    const uint8_t model[] = { GS, '(', 'k', 4, 0, 49, 65, 50, 0 };
    writeBytes(model, sizeof(model));

    // Set size
    const uint8_t qrSize[] = { GS, '(', 'k', 3, 0, 49, 67, size };
    writeBytes(qrSize, sizeof(qrSize));

    // Error correction: M (medium)
    const uint8_t qrErr[] = { GS, '(', 'k', 3, 0, 49, 69, 48 };
    writeBytes(qrErr, sizeof(qrErr));

    // Store data
    uint8_t storeHdr[] = {
        GS, '(', 'k',
        (uint8_t)(pLen & 0xFF), (uint8_t)((pLen >> 8) & 0xFF),
        49, 80, 48
    };
    writeBytes(storeHdr, sizeof(storeHdr));
    writeBytes((const uint8_t*)data, dataLen);

    // Print QR
    const uint8_t print[] = { GS, '(', 'k', 3, 0, 49, 81, 48 };
    writeBytes(print, sizeof(print));
}

// ---------------------------------------------------------------------------
// Printer status polling via ESC/POS DLE EOT
// ---------------------------------------------------------------------------

void pollStatus() {
    PrinterState currentState = state();
    if (currentState == PrinterState::PRINTING) return;

    while (s_uart.available()) {
        s_uart.read();
    }

    // Real-time status request: DLE EOT 4 = paper sensor status.
    // Many ESC/POS printers use bit 2 for near-end and bit 3 for paper-out.
    const uint8_t cmd[] = { 0x10, 0x04, 0x04 };
    writeBytes(cmd, sizeof(cmd));
    vTaskDelay(pdMS_TO_TICKS(40));

    int paperStatus = s_uart.read();
    if (paperStatus < 0) {
        if (PaperEstimator::isPaperLow()) {
            setState(PrinterState::PAPER_LOW);
        } else if (currentState == PrinterState::PAPER_LOW) {
            setState(PrinterState::IDLE);
        }
        return;
    }

    bool paperNearEnd = (paperStatus & 0x04) != 0;
    bool paperOut     = (paperStatus & 0x08) != 0;
    bool estimatedLow = PaperEstimator::isPaperLow();

    if (paperOut) {
        setState(PrinterState::PAPER_OUT);
    } else if (paperNearEnd || estimatedLow) {
        setState(PrinterState::PAPER_LOW);
    } else if (currentState == PrinterState::PAPER_OUT ||
               currentState == PrinterState::PAPER_LOW) {
        setState(PrinterState::IDLE);
    }
}

bool isPaperOut() {
    return state() == PrinterState::PAPER_OUT;
}

bool isOnline() {
    PrinterState currentState = state();
    return currentState != PrinterState::OFFLINE &&
           currentState != PrinterState::ERROR;
}

// ---------------------------------------------------------------------------
// Printer task — runs forever, processes print queue
// ---------------------------------------------------------------------------

void task(void* pv) {
    PrintRequest req;
    TickType_t   printStart = 0;

    for (;;) {
        // Wait for a print request (block up to telemetry interval so
        // we can also do periodic status polls)
        if (xQueueReceive(s_queue, &req, pdMS_TO_TICKS(1000)) == pdTRUE) {

            if (isPaperOut()) {
                EventLog::error("PRINTER", "Print rejected: paper out");
                // Don't print — ack failure if from MQTT
                setState(PrinterState::PAPER_OUT);
                continue;
            }

            setState(PrinterState::PRINTING);
            printStart = xTaskGetTickCount();
            EventLog::info("PRINTER", "Print job started");

            bool success = false;

            switch (req.mode) {
                case PrintMode::NORMAL_TOKEN: {
                    // Build context from current state
                    PrintContext ctx = {};
                    snprintf(ctx.tokenNumber, sizeof(ctx.tokenNumber), "%lu",
                             (unsigned long)req.tokenNumber);

                    struct tm ti;
                    if (getLocalTime(&ti)) {
                        strftime(ctx.dateTime, sizeof(ctx.dateTime),
                                 "%d/%m/%Y %H:%M", &ti);
                    }
                    strlcpy(ctx.siteName,   ConfigStore::net().siteName, sizeof(ctx.siteName));
                    strlcpy(ctx.queueName,  ConfigStore::dev().tokenPrefix, sizeof(ctx.queueName));

                    escInitAndReset();
                    PrintTemplate::render(ctx);
                    success = true;
                    break;
                }

                case PrintMode::TEST_PRINT:
                    escInitAndReset();
                    PrintTemplate::renderTest();
                    success = true;
                    break;

                case PrintMode::CUSTOM_JSON:
                    escInitAndReset();
                    PrintTemplate::renderCustom(req.customJson);
                    success = true;
                    break;
            }

            // Allow paper cut to complete
            vTaskDelay(pdMS_TO_TICKS(500));

            if (success) {
                if (req.mode == PrintMode::NORMAL_TOKEN) {
                    TokenManager::confirmPrinted(req.tokenNumber);
                    PaperEstimator::onTokenPrinted();
                }
                setState(PrinterState::PRINT_SUCCESS);
                EventLog::info("PRINTER", "Print job complete");

                // Brief PRINT_SUCCESS, then back to IDLE
                vTaskDelay(pdMS_TO_TICKS(500));
                setState(PaperEstimator::isPaperLow()
                         ? PrinterState::PAPER_LOW
                         : PrinterState::IDLE);
            } else {
                setState(PrinterState::PRINT_FAILED);
                EventLog::error("PRINTER", "Print job failed");
                vTaskDelay(pdMS_TO_TICKS(1000));
                setState(PrinterState::IDLE);
            }

        } else {
            // Idle poll — check printer status
            pollStatus();
        }

        // Feed watchdog
        // esp_task_wdt_reset(); // Uncomment if TWDT enabled per-task
    }
}

} // namespace PrinterDriver
