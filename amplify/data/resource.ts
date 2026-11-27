import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

/*
 * Access model (enforced by AppSync, not the app):
 * - Every chat row carries `members` (Cognito user `sub`s). Only members can read it or
 *   receive it over the realtime WebSocket.
 * - `members` can be set when a row is created and never changed afterwards, so nobody can
 *   add or remove people from a conversation.
 * - Messages and call signals are stamped with the sender's own `sub` (`senderId` / `fromId`
 *   must equal the caller), so nobody can post as someone else. Messages can't be edited.
 * - Read marks are keyed by (conversationId, userId) and writable only by that user.
 */
const sub = 'sub';

const schema = a.schema({
  Profile: a
    .model({
      userId: a.id().required(),
      email: a.email().required(),
      emailLower: a.string().required(),
      name: a.string().required(),
      color: a.string(),
      lastSeen: a.datetime(),
      muted: a.string().array(),
    })
    .identifier(['userId'])
    .secondaryIndexes((i) => [i('emailLower').queryField('profileByEmail')])
    .authorization((allow) => [
      allow.ownerDefinedIn('userId').identityClaim(sub).to(['create', 'read', 'update']),
      allow.authenticated().to(['read']),
    ]),

  Conversation: a
    .model({
      members: a
        .string()
        .array()
        .required()
        .authorization((allow) => [allow.ownersDefinedIn('members').identityClaim(sub).to(['create', 'read'])]),
      lastMessageAt: a.datetime(),
      lastPreview: a.string(),
      messages: a.hasMany('Message', 'conversationId'),
    })
    .authorization((allow) => [allow.ownersDefinedIn('members').identityClaim(sub).to(['create', 'read', 'update'])]),

  Message: a
    .model({
      conversationId: a.id().required(),
      conversation: a.belongsTo('Conversation', 'conversationId'),
      senderId: a.string().required(),
      text: a.string(),
      atts: a.json(),
      sentAt: a.datetime().required(),
      members: a.string().array().required(),
    })
    .secondaryIndexes((i) => [i('conversationId').sortKeys(['sentAt']).queryField('messagesByConversation')])
    .authorization((allow) => [
      allow.ownerDefinedIn('senderId').identityClaim(sub).to(['create', 'read']),
      allow.ownersDefinedIn('members').identityClaim(sub).to(['read']),
    ]),

  /** Per user, per conversation: read position and "cleared" position. */
  ReadMark: a
    .model({
      conversationId: a.id().required(),
      userId: a.string().required(),
      readAt: a.datetime(),
      clearedAt: a.datetime(),
      members: a
        .string()
        .array()
        .required()
        .authorization((allow) => [
          allow.ownerDefinedIn('userId').identityClaim(sub).to(['create', 'read']),
          allow.ownersDefinedIn('members').identityClaim(sub).to(['read']),
        ]),
    })
    .identifier(['conversationId', 'userId'])
    .authorization((allow) => [
      allow.ownerDefinedIn('userId').identityClaim(sub).to(['create', 'read', 'update']),
      allow.ownersDefinedIn('members').identityClaim(sub).to(['read']),
    ]),

  /** WebRTC call signalling (offer / answer / ICE / end), pushed over the realtime WebSocket. */
  CallSignal: a
    .model({
      conversationId: a.id().required(),
      callId: a.string().required(),
      fromId: a.string().required(),
      toId: a.string().required(),
      kind: a.string().required(),
      payload: a.json(),
      members: a.string().array().required(),
    })
    .authorization((allow) => [
      allow.ownerDefinedIn('fromId').identityClaim(sub).to(['create', 'read']),
      allow.ownersDefinedIn('members').identityClaim(sub).to(['read', 'delete']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});
