import * as Flex from '@twilio/flex-ui';

type FlexUIAttributes = Flex.ServiceConfiguration['ui_attributes'];

export interface UIAttributes extends FlexUIAttributes {
  custom_data: {
    serverless_functions_protocol: string;
    serverless_functions_domain_leroy_demo_flex_leroy_demo: string;
    serverless_functions_port: string;
    language: string;
    features: any;
  };
}
