import { randomUUID } from 'node:crypto';

// Cabecera de mensaje inspirada en ISO 20022 (GroupHeader: MsgId + CreDtTm)
export const groupHeader = () => ({
  MessageIdentification: randomUUID(),
  CreationDateTime: new Date().toISOString(),
});

export const ok = (res, body) => res.json({ GroupHeader: groupHeader(), ...body });

export const error = (res, status, code, message) =>
  res.status(status).json({ GroupHeader: groupHeader(), Errors: [{ Code: code, Message: message }] });
