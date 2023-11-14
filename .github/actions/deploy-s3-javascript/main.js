const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");

function run() {
  // 1) input 값을 가져옵니다.
  const bucket = core.getInput("bucket", { required: true });
  const bucketRegion = core.getInput("bucket-region", { required: true });
  const distFolder = core.getInput("dist-folder", { required: true });

  // 참고
  // github.getOctokit: GitHub REST API 요청을 쉽게 보낼 수 있습니다.
  // github.context: GitHub Action 파일 내부에서 참조하는 컨텍스트와 같은 값을 일부 참조할 수 있습니다.

  // 2) 파일을 업로드 합니다.
  const s3Uri = `s3://${bucket}`;
  // local-folder, s3-bucket flag와 함께 AWS CLI를 실행할 수 있습니다.
  // exec.exec('aws s3 sync <local-folder> <s3-bucket> --region <bucket-region>');
  exec.exec(`aws s3 sync ${distFolder} ${s3Uri} --region ${bucketRegion}`);

  core.notice("Hello from my custom JavaScript Action!");
}

run();
