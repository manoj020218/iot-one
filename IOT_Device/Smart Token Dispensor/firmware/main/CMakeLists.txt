#
# This component intentionally gives PlatformIO's ESP-IDF builder the
# canonical `main` source target while redirecting the real source tree back
# into `src/`.
#
set(td_src_dir "${CMAKE_SOURCE_DIR}/src")

file(GLOB_RECURSE td_app_sources
    "${td_src_dir}/*.c"
    "${td_src_dir}/*.cpp"
    "${td_src_dir}/*.S"
)

idf_component_register(
    SRCS ${td_app_sources}
    INCLUDE_DIRS "${td_src_dir}"
)
