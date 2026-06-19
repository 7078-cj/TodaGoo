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