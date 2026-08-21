#include "mdns.h"

esp_err_t mdns_init(void) { return ESP_ERR_NOT_SUPPORTED; }

void mdns_free(void) {}

esp_err_t mdns_hostname_set(const char *hostname) {
    return hostname ? ESP_OK : ESP_ERR_INVALID_ARG;
}

esp_err_t mdns_instance_name_set(const char *instance_name) {
    return instance_name ? ESP_OK : ESP_ERR_INVALID_ARG;
}

esp_err_t mdns_service_add(const char *instance_name, const char *service_type,
                           const char *proto, uint16_t port,
                           mdns_txt_item_t txt[], size_t num_items) {
    (void)instance_name;
    (void)service_type;
    (void)proto;
    (void)port;
    (void)txt;
    (void)num_items;
    return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t mdns_service_remove(const char *service_type, const char *proto) {
    (void)service_type;
    (void)proto;
    return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t mdns_service_txt_item_set(const char *service_type, const char *proto,
                                    const char *key, const char *value) {
    (void)service_type;
    (void)proto;
    (void)key;
    (void)value;
    return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t mdns_service_instance_name_set(const char *service_type,
                                         const char *proto,
                                         const char *instance_name) {
    (void)service_type;
    (void)proto;
    (void)instance_name;
    return ESP_ERR_NOT_SUPPORTED;
}

esp_err_t mdns_query_a(const char *host_name, uint32_t timeout,
                       esp_ip4_addr_t *addr) {
    (void)host_name;
    (void)timeout;
    if (!addr) {
        return ESP_ERR_INVALID_ARG;
    }
    addr->addr = 0;
    return ESP_ERR_NOT_FOUND;
}

esp_err_t mdns_query_ptr(const char *service_type, const char *proto,
                         uint32_t timeout, size_t max_results,
                         mdns_result_t **results) {
    (void)service_type;
    (void)proto;
    (void)timeout;
    (void)max_results;
    if (results) {
        *results = NULL;
    }
    return ESP_ERR_NOT_FOUND;
}

void mdns_query_results_free(mdns_result_t *results) { (void)results; }
