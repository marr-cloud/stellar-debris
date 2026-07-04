const LOCAL = 'unknown (local dev — deploy to see real value)'

export function cfInfo(cf: IncomingRequestCfProperties | undefined) {
  return {
    http_protocol: cf?.httpProtocol ?? LOCAL,
    tls_version: cf?.tlsVersion ?? LOCAL,
    cipher: cf?.tlsCipher ?? LOCAL,
    colo: cf?.colo ?? null,
    country: cf?.country ?? null,
    as_organization: cf?.asOrganization ?? null,
  }
}
