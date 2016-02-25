package tls

import (
	"testing"

	"github.com/hashicorp/terraform/helper/schema"
	"github.com/hashicorp/terraform/terraform"
)

func TestProvider(t *testing.T) {
	if err := Provider().(*schema.Provider).InternalValidate(); err != nil {
		t.Fatalf("err: %s", err)
	}
}

var testProviders = map[string]terraform.ResourceProvider{
	"tls": Provider(),
}

var testPrivateKey = `
-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQDPLaq43D9C596ko9yQipWUf2FbRhFs18D3wBDBqXLIoP7W3rm5
S292/JiNPa+mX76IYFF416zTBGG9J5w4d4VFrROn8IuMWqHgdXsCUf2szN7EnJcV
BsBzTxxWqz4DjX315vbm/PFOLlKzC0Ngs4h1iDiCD9Hk2MajZuFnJiqj1QIDAQAB
AoGAG6eQ3lQn7Zpd0cQ9sN2O0d+e8zwLH2g9TdTJZ9Bijf1Phwb764vyOQPGqTPO
unqVSEbzGRpQ62nuUf1zkOYDV+gKMNO3mj9Zu+qPNr/nQPHIaGZksPdD34qDUnBl
eRWVGNTyEGQsRPNN0RtFj8ifa4+OWiE30n95PBq2bUGZj4ECQQDZvS5X/4jYxnzw
CscaL4vO9OCVd/Fzdpfak0DQE/KCVmZxzcXu6Q8WuhybCynX84WKHQxuFAo+nBvr
kgtWXX7dAkEA85Vs5ehuDujBKCu3NJYI2R5ie49L9fEMFJVZK9FpkKacoAkET5BZ
UzaZrx4Fg3Zhcv1TssZKSyle+2lYiIydWQJBAMW8/aJi6WdcUsg4MXrBZSlsz6xO
AhOGxv90LS8KfnkJd/2wDyoZs19DY4kWSUjZ2hOEr+4j+u3DHcQAnJUxUW0CQGXP
DrUJcPbKUfF4VBqmmwwkpwT938Hr/iCcS6kE3hqXiN9a5XJb4vnk2FdZNPS9hf2J
5HHUbzj7EbgDT/3CyAECQG0qv6LNQaQMm2lmQKmqpi43Bqj9wvx0xGai1qCOvSeL
rpxCHbX0xSJh0s8j7exRHMF8W16DHjjkc265YdWPXWo=
-----END RSA PRIVATE KEY-----
`

var testCertRequest = `
-----BEGIN CERTIFICATE REQUEST-----
MIICYDCCAckCAQAwgcUxFDASBgNVBAMMC2V4YW1wbGUuY29tMQswCQYDVQQGEwJV
UzELMAkGA1UECAwCQ0ExFjAUBgNVBAcMDVBpcmF0ZSBIYXJib3IxGTAXBgNVBAkM
EDU4NzkgQ290dG9uIExpbmsxEzARBgNVBBEMCjk1NTU5LTEyMjcxFTATBgNVBAoM
DEV4YW1wbGUsIEluYzEoMCYGA1UECwwfRGVwYXJ0bWVudCBvZiBUZXJyYWZvcm0g
VGVzdGluZzEKMAgGA1UEBRMBMjCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkCgYEA
qLFq7Tpmlt0uDCCn5bA/oTj4v16/pXXaD+Ice2bS4rBH2UUM2gca5U4j8QCxrIxh
91mBvloE4VS5xrIGotAwoMgwK3E2md5kzQJToDve/hm8JNOcms+OAOjfjajPc40e
+ue9roT8VjWGU0wz7ttQNuao56GXYr5kOpcfiZMs7RcCAwEAAaBaMFgGCSqGSIb3
DQEJDjFLMEkwLwYDVR0RBCgwJoILZXhhbXBsZS5jb22CC2V4YW1wbGUubmV0hwR/
AAABhwR/AAACMAkGA1UdEwQCMAAwCwYDVR0PBAQDAgXgMA0GCSqGSIb3DQEBBQUA
A4GBAGEDWUYnGygtnvScamz3o4PuVMFubBfqIdWCu02hBgzL3Hi3/UkOEsV028GM
M3YMB+it7U8eDdT2XjzBDlvpxWT1hXWnmJFu6z6B8N/JFk8fOkaP7U6YjZlG5N9m
L1A4WtQz0SgXcnIujKisqIaymYrvpANnm4IsqTKsnwZD7CsQ
-----END CERTIFICATE REQUEST-----
`

var testCAPrivateKey = `
-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQC7QNFtw54heoD9KL2s2Qr7utKZFM/8GXYHh3Y5/Zis9USlJ7Mc
Lorbmm9Lopnr5zUBZULAxAgX51X0FbifK8Re3JIZvpFRyxNw8aWYBnOk/sX7UhUH
pI139dSAhkNAMkRQd1ySpDP+4okCptgZPs7h0bXwoYmWMNFKlaRZHuAQLQIDAQAB
AoGAQ/YwjLAU8n2t1zQ0M0nLDLYvvVOqcQskpXLq2/1Irm2OborMHQxfZXjVsBPh
3ZbazBjec2wyq8pQjfhcO5j8+fj9zLtRNDpWEa9t/VDky0MSGezQyLL1J5+htFDJ
JDCkKK441IWKGCMC31hoVP6PvE/3G2+vWAkrkT4U7ekLQVkCQQD1/RKMxDFJ57Qr
Zlu1y72dnGLsGqoxeNaco6G5JXAEEcWTx8qXghKQX0uHxooeRYQRupOGLBo1Js1p
/AZDR8inAkEAwt/J0GDsojV89RbpJ0h7C1kcxNULooCYQZs/rmJcVXSs6pUIIFdI
oYQIEGnRsfQUPo6EUUGMKh8sSEjF6R8nCwJBAMKYuoT7a9aAYwp2RhTSIaW+oo8P
JRZP9s8hr31tPWkqufeHdSBYOOFXUcQObxM1gR4ZUD0zRGRJ1vSB+F5fOj8CQEuG
HZnTpoHrBuWZnnyp+33XaG3kP2EYQ2nRuClmV3CLCmTTo1WdXjmyiMmLqUg1Vw8z
fpZbN+4vLKNLCOCjQScCQDWmNDrie4Omd5wWKV5B+LVZO8/xMlub6IEioZpMfDGZ
q1Ov/Qw2ge3yumfO+6GzKG0k13yYEn1AcatF5lP8BYY=
-----END RSA PRIVATE KEY-----
`

var testCACert = `
-----BEGIN CERTIFICATE-----
MIIDVTCCAr6gAwIBAgIJALLsVgWAcCvxMA0GCSqGSIb3DQEBBQUAMHsxCzAJBgNV
BAYTAlVTMQswCQYDVQQIEwJDQTEWMBQGA1UEBxMNUGlyYXRlIEhhcmJvcjEVMBMG
A1UEChMMRXhhbXBsZSwgSW5jMSEwHwYDVQQLExhEZXBhcnRtZW50IG9mIENBIFRl
c3RpbmcxDTALBgNVBAMTBHJvb3QwHhcNMTUxMTE0MTY1MTQ0WhcNMTUxMjE0MTY1
MTQ0WjB7MQswCQYDVQQGEwJVUzELMAkGA1UECBMCQ0ExFjAUBgNVBAcTDVBpcmF0
ZSBIYXJib3IxFTATBgNVBAoTDEV4YW1wbGUsIEluYzEhMB8GA1UECxMYRGVwYXJ0
bWVudCBvZiBDQSBUZXN0aW5nMQ0wCwYDVQQDEwRyb290MIGfMA0GCSqGSIb3DQEB
AQUAA4GNADCBiQKBgQC7QNFtw54heoD9KL2s2Qr7utKZFM/8GXYHh3Y5/Zis9USl
J7McLorbmm9Lopnr5zUBZULAxAgX51X0FbifK8Re3JIZvpFRyxNw8aWYBnOk/sX7
UhUHpI139dSAhkNAMkRQd1ySpDP+4okCptgZPs7h0bXwoYmWMNFKlaRZHuAQLQID
AQABo4HgMIHdMB0GA1UdDgQWBBQyrsMhTd85ATqm9vNybTtAbwnGkDCBrQYDVR0j
BIGlMIGigBQyrsMhTd85ATqm9vNybTtAbwnGkKF/pH0wezELMAkGA1UEBhMCVVMx
CzAJBgNVBAgTAkNBMRYwFAYDVQQHEw1QaXJhdGUgSGFyYm9yMRUwEwYDVQQKEwxF
eGFtcGxlLCBJbmMxITAfBgNVBAsTGERlcGFydG1lbnQgb2YgQ0EgVGVzdGluZzEN
MAsGA1UEAxMEcm9vdIIJALLsVgWAcCvxMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcN
AQEFBQADgYEAuJ7JGZlSzbQOuAFz2t3c1pQzUIiS74blFbg6RPvNPSSjoBg3Ly61
FbliR8P3qiSWA/X03/XSMTH1XkHU8re+P0uILUzLJkKBkdHJfdwfk8kifDjdO14+
tffPaqAEFUkwhbiQUoj9aeTOOS6kEjbMV6+o7fsz5pPUHbj/l4idys0=
-----END CERTIFICATE-----
`
