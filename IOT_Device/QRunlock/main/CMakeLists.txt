set(qru_src_dir "${CMAKE_SOURCE_DIR}/src")

file(GLOB_RECURSE qru_app_sources
    "${qru_src_dir}/*.c"
    "${qru_src_dir}/*.cpp"
    "${qru_src_dir}/*.S"
)

idf_component_register(
    SRCS ${qru_app_sources}
    INCLUDE_DIRS "${qru_src_dir}"
)
