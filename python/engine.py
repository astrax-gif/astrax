"""Python wrapper around the C++ price engine (native/quote.cpp)."""
import ctypes
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_LIB_PATH = os.path.join(_HERE, "libquote.so")
BUILD_CMD = "g++ -O2 -shared -fPIC -o libquote.so native/quote.cpp"

if not os.path.exists(_LIB_PATH):
    raise RuntimeError(f"libquote.so not found. Build it first: {BUILD_CMD}")

_lib = ctypes.CDLL(_LIB_PATH)
_lib.quote_usd.argtypes = [ctypes.c_int] * 5 + [ctypes.POINTER(ctypes.c_int)]
_lib.quote_usd.restype = ctypes.c_int

ERRORS = {
    -1: "Internal error.",
    -2: "Unknown plan.",
    -3: "Online payments are only available on the Fully Dynamic plan.",
    -4: "A value is out of range.",
}


class QuoteError(Exception):
    pass


def quote(plan: int, extra_pages: int, integrations: int, extra_gateways: int, rush: bool) -> dict:
    out = (ctypes.c_int * 6)()
    code = _lib.quote_usd(plan, extra_pages, integrations, extra_gateways, int(rush), out)
    if code != 0:
        raise QuoteError(ERRORS.get(code, "Could not calculate the estimate."))
    base, pages, integ, gateways, rush_fee, total = list(out)
    return {
        "total": total,
        "breakdown": {"base": base, "extra_pages": pages, "integrations": integ,
                      "gateways": gateways, "rush": rush_fee},
    }
