// app.config.js — app.json 위에 얹어서 EAS 환경변수(GOOGLE_SERVICES_JSON) 참조.
// EAS 빌드에서는 file 타입 env var가 임시 경로에 파일을 만들고, 그 경로를 값으로 넘긴다.
// 로컬 빌드/dev에서는 ./google-services.json fallback.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
  },
});
