export class CodedError extends Error {
  code?: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class EventEmitter {}
export class NativeModule {}
export class SharedObject {}
export class SharedRef {}

export function requireOptionalNativeModule() {
  return null;
}
