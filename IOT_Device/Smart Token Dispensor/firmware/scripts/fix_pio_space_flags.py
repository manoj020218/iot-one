Import("env")


def _normalize(value):
    return str(value).replace("\\", "/")


project_fragments = [_normalize(fragment) for fragment in env.subst("$PROJECT_DIR").split()]


def _should_drop(flag):
    normalized = _normalize(flag).strip("\"")
    if normalized.startswith("-fmacro-prefix-map=") and any(
        fragment in normalized for fragment in project_fragments
    ):
        return True
    return any(
        normalized == fragment
        or normalized == f"{fragment}=."
        or normalized.startswith(f"{fragment}=.")
        for fragment in project_fragments
    )


for key in ("ASFLAGS", "CCFLAGS", "CFLAGS", "CXXFLAGS", "CPPFLAGS", "LINKFLAGS"):
    values = env.get(key)
    if not values:
        continue

    sanitized = []
    for value in values:
        if isinstance(value, str) and _should_drop(value):
            continue
        sanitized.append(value)

    env.Replace(**{key: sanitized})
