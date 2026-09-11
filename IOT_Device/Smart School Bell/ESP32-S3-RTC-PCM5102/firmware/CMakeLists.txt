cmake_minimum_required(VERSION 3.16)

# components/jenix_provisioning is a thin forwarding stub (see its own
# CMakeLists.txt) pointing at IOT_Device/_shared/jenix_provisioning -- the
# real, single-source-of-truth shared component (PROVISIONING.md Section
# 8a). ESP-IDF auto-discovers "components/" with no EXTRA_COMPONENT_DIRS
# needed; this project's path contains spaces ("jenix One", "Smart School
# Bell"), and ESP-IDF's EXTRA_COMPONENT_DIRS space-disambiguation heuristic
# (tools/split_paths_by_spaces.py) cannot reliably parse a second
# space-containing entry alongside PlatformIO's own "src" entry -- tried,
# confirmed broken 2026-09-11, hence this stub instead of pointing
# EXTRA_COMPONENT_DIRS straight at ../../_shared.
include($ENV{IDF_PATH}/tools/cmake/project.cmake)
set(PROJECT_VER "0.6.2-sd-stat-fix")
project(JenixSchoolBell)
