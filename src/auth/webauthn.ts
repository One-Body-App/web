function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function arrayBufferToBase64Url(value: ArrayBuffer | null): string | null {
  if (!value) return null;
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function credentialDescriptorFromJson(credential: any): PublicKeyCredentialDescriptor {
  return {
    ...credential,
    id: base64UrlToArrayBuffer(String(credential.id)),
  };
}

function registrationOptionsFromJson(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64UrlToArrayBuffer(String(options.challenge)),
    user: {
      ...options.user,
      id: base64UrlToArrayBuffer(String(options.user?.id)),
    },
    excludeCredentials: Array.isArray(options.excludeCredentials)
      ? options.excludeCredentials.map(credentialDescriptorFromJson)
      : undefined,
  };
}

function authenticationOptionsFromJson(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64UrlToArrayBuffer(String(options.challenge)),
    allowCredentials: Array.isArray(options.allowCredentials)
      ? options.allowCredentials.map(credentialDescriptorFromJson)
      : undefined,
  };
}

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.PublicKeyCredential && navigator.credentials);
}

export async function createPasskeyCredential(options: unknown): Promise<Record<string, unknown>> {
  if (!isWebAuthnSupported()) {
    throw new Error('Passkeys are not supported in this browser.');
  }

  const credential = (await navigator.credentials.create({
    publicKey: registrationOptionsFromJson(options),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey registration was cancelled.');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64Url(response.attestationObject),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

export async function getPasskeyCredential(options: unknown): Promise<Record<string, unknown>> {
  if (!isWebAuthnSupported()) {
    throw new Error('Passkeys are not supported in this browser.');
  }

  const credential = (await navigator.credentials.get({
    publicKey: authenticationOptionsFromJson(options),
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey verification was cancelled.');
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: arrayBufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
      signature: arrayBufferToBase64Url(response.signature),
      userHandle: arrayBufferToBase64Url(response.userHandle),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}
