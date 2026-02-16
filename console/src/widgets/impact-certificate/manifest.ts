import type { WidgetManifest } from '@estream/sdk-browser/widgets';

export const IMPACT_CERTIFICATE_MANIFEST: WidgetManifest = {
  id: 'sc-impact-certificate',
  name: 'Impact Certificate',
  description: 'Visual retirement certificate with verification QR code and provenance chain',
  category: 'impact',
  version: '1.0.0',
  roles: ['buyer'],
  data_sources: {
    lex_topics: ['lex://sc/retirements/certificate'],
    eslite_tables: ['retirements', 'carbon_credits'],
  },
  size: {
    min_width: 3,
    min_height: 3,
    default_width: 4,
    default_height: 4,
  },
  spark_actions: [],
  icon: 'certificate',
  embeddable: true,
};
