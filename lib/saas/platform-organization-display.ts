type PlatformOrganizationIdentitySource =
  | 'manual'
  | 'google_self_service'
  | 'email_otp_self_service'
  | 'phone_otp_self_service';

type PlatformOrganizationIdentity = {
  name: string;
  ownerEmail: string | null;
  provisioningSource: PlatformOrganizationIdentitySource;
};

export type PlatformOrganizationDisplayIdentity = {
  primaryLabel: string;
  secondaryLabel: string | null;
};

export function getPlatformOrganizationDisplayIdentity(
  organization: PlatformOrganizationIdentity
): PlatformOrganizationDisplayIdentity {
  const ownerEmail = organization.ownerEmail?.trim() || null;

  if (organization.provisioningSource === 'google_self_service' && ownerEmail) {
    return {
      primaryLabel: ownerEmail,
      secondaryLabel: null,
    };
  }

  return {
    primaryLabel: organization.name,
    secondaryLabel: ownerEmail,
  };
}
