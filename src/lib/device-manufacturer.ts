/** Ported from manufacturerLookup() in includes/device-manufacturer.php. */
export type ManufacturerLookup = {
  manufacturer: string;
  serial: string;
  productNumber: string;
  warrantyCode: string;
  url: string;
};

export function manufacturerLookup(rawIdentifier: string): ManufacturerLookup {
  const parts = rawIdentifier
    .trim()
    .split(/\s*[,;|]\s*/)
    .map((p) => p.trim())
    .filter((p) => p !== "");

  const serial = parts[0] ?? rawIdentifier.trim();
  const productNumber = parts[1] ?? "";
  const warrantyCode = parts[2] ?? "";
  let manufacturer = "Manufacturer";
  let url: string;

  const looksLikeHp =
    /^(5CG|CND|MXL|SGH|VNB)[A-Z0-9]+$/i.test(serial) ||
    /^[A-Z0-9]{5,12}#[A-Z0-9]{3,5}$/i.test(productNumber);

  if (looksLikeHp) {
    manufacturer = "HP";
    url = "https://support.hp.com/us-en/products/identify";
  } else {
    const cleanProductNumber = productNumber.replace(/#[A-Z0-9]+$/i, "");
    const terms = [serial, cleanProductNumber].filter(Boolean).join(" ").trim();
    url = `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
  }

  return { manufacturer, serial, productNumber, warrantyCode, url };
}
