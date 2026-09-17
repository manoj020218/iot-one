"""
Pre-build script: injects current build timestamp into build_flags.
"""
Import("env")
import datetime

ts = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
env.Append(CPPDEFINES=[("BUILD_TIMESTAMP", '\\"%s\\"' % ts)])
