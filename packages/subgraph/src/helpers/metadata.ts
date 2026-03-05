import { Bytes, json, JSONValueKind } from "@graphprotocol/graph-ts";

const DATA_URI_PREFIX = "data:application/json;base64,";

// Base64 lookup table
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export class ParsedMetadata {
  name: string;
  category: string;

  constructor() {
    this.name = "Unknown Skill";
    this.category = "Uncategorized";
  }
}

/**
 * Decode a base64 string to a Uint8Array.
 * Inline implementation to avoid as-base64 compatibility issues with graph-ts.
 */
function decodeBase64(input: string): Uint8Array {
  // Strip padding
  let str = input;
  while (str.endsWith("=")) {
    str = str.slice(0, str.length - 1);
  }

  let outputLen = (str.length * 3) / 4;
  let output = new Uint8Array(outputLen as i32);
  let p = 0;

  for (let i = 0; i < str.length; i += 4) {
    let a = BASE64_CHARS.indexOf(str.charAt(i));
    let b = i + 1 < str.length ? BASE64_CHARS.indexOf(str.charAt(i + 1)) : 0;
    let c = i + 2 < str.length ? BASE64_CHARS.indexOf(str.charAt(i + 2)) : 0;
    let d = i + 3 < str.length ? BASE64_CHARS.indexOf(str.charAt(i + 3)) : 0;

    if (a < 0) a = 0;
    if (b < 0) b = 0;
    if (c < 0) c = 0;
    if (d < 0) d = 0;

    let bits = (a << 18) | (b << 12) | (c << 6) | d;

    if (p < output.length) output[p++] = (bits >> 16) & 0xff;
    if (p < output.length) output[p++] = (bits >> 8) & 0xff;
    if (p < output.length) output[p++] = bits & 0xff;
  }

  return output;
}

/**
 * Parse a metadata URI and extract name + category.
 * Only data: URIs can be parsed in the subgraph runtime.
 */
export function parseMetadataURI(uri: string): ParsedMetadata {
  let result = new ParsedMetadata();

  if (!uri.startsWith(DATA_URI_PREFIX)) {
    return result;
  }

  let base64Str = uri.slice(DATA_URI_PREFIX.length);
  let decoded = decodeBase64(base64Str);

  let bytes = Bytes.fromUint8Array(decoded);
  let jsonResult = json.try_fromBytes(bytes);

  if (jsonResult.isError) {
    return result;
  }

  let value = jsonResult.value;
  if (value.kind != JSONValueKind.OBJECT) {
    return result;
  }

  let obj = value.toObject();

  // Handle aegis/audit-metadata@1 which nests under "skill"
  let skillEntry = obj.get("skill");
  let target = skillEntry != null && skillEntry.kind == JSONValueKind.OBJECT
    ? skillEntry.toObject()
    : obj;

  let nameVal = target.get("name");
  if (nameVal != null && nameVal.kind == JSONValueKind.STRING) {
    result.name = nameVal.toString();
  }

  let catVal = target.get("category");
  if (catVal != null && catVal.kind == JSONValueKind.STRING) {
    result.category = catVal.toString();
  }

  return result;
}
