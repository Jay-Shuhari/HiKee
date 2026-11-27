import { defineAuth } from '@aws-amplify/backend';

/** Email + password sign-in through Amazon Cognito. The display name is stored in the
 *  standard `name` attribute (CDK key `fullname`) and copied into the Profile row. */
export const auth = defineAuth({
  loginWith: { email: true },
  userAttributes: {
    fullname: { required: false, mutable: true },
  },
  accountRecovery: 'EMAIL_ONLY',
});
