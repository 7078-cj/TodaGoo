def reconstruct_nested(data, prefix):
    """
    Converts flat multipart keys like 'driver_profile.address'
    into a real nested dict, and returns a plain dict (not QueryDict)
    so DRF doesn't treat it as HTML form input.
    """
    plain_data = {}
    nested = {}

    for key in data.keys():
        value = data.get(key)
        if key.startswith(prefix):
            inner_key = key[len(prefix):]
            nested[inner_key] = value
        else:
            plain_data[key] = value

    if nested:
        plain_data[prefix.rstrip(".")] = nested

    return plain_data


def collect_indexed_lists(data):
    """
    Turns flat multipart list keys like 'evidence_files[0]', 'evidence_files[1]' (what the mobile
    app's buildFormData sends) into real lists: {'evidence_files': [f0, f1]}, ordered by index.
    reconstruct_nested() returns a plain dict, where DRF no longer parses the [n] keys itself, so
    without this every list field (evidence photos, tags) arrived empty.
    """
    import re

    pattern = re.compile(r"^(?P<name>[^\[\]]+)\[(?P<index>\d+)\]$")
    result, lists = {}, {}
    for key, value in data.items():
        match = pattern.match(key)
        if match:
            lists.setdefault(match["name"], []).append((int(match["index"]), value))
        else:
            result[key] = value
    for name, items in lists.items():
        result[name] = [value for _, value in sorted(items, key=lambda item: item[0])]
    return result
