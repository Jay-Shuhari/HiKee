import { defineStorage } from '@aws-amplify/backend';

/** Chat attachments. Each user writes only under their own identity id; any signed-in user can
 *  read (object keys contain random UUIDs and are only shared inside conversations). */
export const storage = defineStorage({
  name: 'hikeeMedia',
  access: (allow) => ({
    'media/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
    ],
  }),
});
