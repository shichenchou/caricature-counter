import os
import struct
import sys
import zlib


def png(size, path):
    bg = (0xF2, 0x7A, 0x5E)
    fg = (0xFF, 0xFF, 0xFF)
    c = size / 2
    r = size * 0.30
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            d = ((x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2) ** 0.5
            row += bytes(fg if d <= r else bg)
        rows.append(bytes(row))

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    data = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
        + chunk(b'IEND', b'')
    )
    with open(path, 'wb') as f:
        f.write(data)


out = sys.argv[1]
for name, s in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    png(s, os.path.join(out, name))
    print(name, s)
