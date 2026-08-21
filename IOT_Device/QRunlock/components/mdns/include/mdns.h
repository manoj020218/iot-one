#pragma once

#include <stddef.h>
#include <stdint.h>

#include "esp_err.h"
#include "esp_interface.h"
#include "esp_netif_ip_addr.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct mdns_txt_item_s {
    char *key;
    char *value;
} mdns_txt_item_t;

typedef enum {
    MDNS_IP_PROTOCOL_V4 = 0,
    MDNS_IP_PROTOCOL_V6 = 1,
} mdns_ip_protocol_t;

typedef struct mdns_ip_addr_s {
    struct mdns_ip_addr_s *next;
    struct {
        mdns_ip_protocol_t type;
        union {
            esp_ip4_addr_t ip4;
            esp_ip6_addr_t ip6;
        } u_addr;
    } addr;
} mdns_ip_addr_t;

typedef struct mdns_result_s {
    struct mdns_result_s *next;
    mdns_ip_addr_t *addr;
    mdns_txt_item_t *txt;
    char *hostname;
    uint16_t port;
    size_t txt_count;
} mdns_result_t;

esp_err_t mdns_init(void);
void mdns_free(void);
esp_err_t mdns_hostname_set(const char *hostname);
esp_err_t mdns_instance_name_set(const char *instance_name);
esp_err_t mdns_service_add(const char *instance_name, const char *service_type,
                           const char *proto, uint16_t port,
                           mdns_txt_item_t txt[], size_t num_items);
esp_err_t mdns_service_remove(const char *service_type, const char *proto);
esp_err_t mdns_service_txt_item_set(const char *service_type, const char *proto,
                                    const char *key, const char *value);
esp_err_t mdns_service_instance_name_set(const char *service_type,
                                         const char *proto,
                                         const char *instance_name);
esp_err_t mdns_query_a(const char *host_name, uint32_t timeout,
                       esp_ip4_addr_t *addr);
esp_err_t mdns_query_ptr(const char *service_type, const char *proto,
                         uint32_t timeout, size_t max_results,
                         mdns_result_t **results);
void mdns_query_results_free(mdns_result_t *results);

#ifdef __cplusplus
}
#endif
