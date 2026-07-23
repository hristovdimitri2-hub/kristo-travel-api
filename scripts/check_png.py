import struct, os
for n in [192, 512]:
    p = "/home/z/my-project/public/icon-%d.png" % n
    d = open(p, "rb").read(30)
    w, h = struct.unpack(">II", d[16:24])
    print("icon-%d.png: %dx%d, %dB" % (n, w, h, os.path.getsize(p)))