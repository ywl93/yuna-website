import qrcode
from qrcode.constants import ERROR_CORRECT_H

url = "https://yuna-tea.com/contact.html"

qr = qrcode.QRCode(
    version=None,
    error_correction=ERROR_CORRECT_H,
    box_size=20,
    border=4,
)
qr.add_data(url)
qr.make(fit=True)

img = qr.make_image(fill_color="black", back_color="white")
img.save("yuna-tea-qr.png")

print(f"Saved yuna-tea-qr.png  -  {img.size[0]}x{img.size[1]} px  -  url: {url}")
