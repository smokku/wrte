// @flow
import type { Message } from './ipc'

/* eslint-disable import/prefer-default-export */
export function errorReply (error: string, message: Message): Message {
  const errorMessage = {
    type: 'ERROR',
    payload: {
      type: error.toString(),
      message,
    },
  }
  if (message.id != null) {
    errorMessage.id = message.id
  }
  return errorMessage
}
