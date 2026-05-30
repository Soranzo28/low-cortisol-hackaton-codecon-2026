"""
Gera certificado SSL autoassinado para uso local com uvicorn.
Instalar dependência: python -m pip install cryptography
Rodar: python gen_certs.py
"""
import datetime, ipaddress, pathlib
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

OUT = pathlib.Path(__file__).parent

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.datetime.utcnow())
    .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=825))
    .add_extension(
        x509.SubjectAlternativeName([
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
            x509.IPAddress(ipaddress.IPv4Address("192.168.3.10")),
        ]),
        critical=False,
    )
    .sign(key, hashes.SHA256())
)

(OUT / "cert.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
(OUT / "key.pem").write_bytes(key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
))

print("✅  cert.pem e key.pem gerados em", OUT)
