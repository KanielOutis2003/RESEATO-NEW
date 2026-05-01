import "i18next";
import "react-i18next";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
    returnEmptyString: false;
  }
}

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    returnNull: false;
  }
}
