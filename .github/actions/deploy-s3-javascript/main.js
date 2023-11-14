const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");

function run() {
  // 1) input 값을 가져옵니다.
  const bucket = core.getInput("bucket", { required: true });
  const bucketRegion = core.getInput("bucket-region", { required: true });
  const distFolder = core.getInput("dist-folder", { required: true });

  // 2) 파일을 업로드 합니다.
  const s3Uri = `s3://${bucket}`;
  exec.exec(`aws s3 sync ${distFolder} ${s3Uri} --region ${bucketRegion}`);

  // AWS S3에서 정적 페이지를 호스팅하게 되면, 아래와 같은 규칙으로 웹 사이트의 URL을 생성하여 발행합니다.
  const websiteUrl = `http://${bucket}.s3-website.${bucketRegion}.amazonaws.com`;
  // core.setOutput(output 이름, output 이름으로 반환할 값)
  core.setOutput("website-url", websiteUrl);
}

run();
