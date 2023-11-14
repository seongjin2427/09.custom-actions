# 09. Building & Using Custom Actions

---

# Initial Workflow

1. `lint`

2. `test` - `build`

---

## Types of Custom Actions

- Composite Action

- JavaScript Action

- Docker Action

---

## Composite Action

1. Custom Composite Action을 분리하기 위한 별도의 파일을 만들어 정의해 봅니다. - [`3dd1e249`](https://github.com/seongjin2427/09.custom-actions/commit/3dd1e24963cebccf502841ef1ed4683ff66bcd85)

- Process
  - `./.github/actions/ached-deps/action.yml`
    - `actions` 폴더 명은 원하는 대로 지정할 수 있지만, 일반적으로 `actions`로 지정합니다.
    - `cached-deps` 폴더 명은 Custom Action의 이름이 됩니다.
    - `action.yml` 파일명은 반드시 `action`으로 지정되어야 합니다.
    - ```yml
        name: "Get & Cache Dependencies"
        # 커스텀 액션은 on 키를 지정하지 않습니다.
        # 마켓플레이스에 퍼블리쉬되면 보일 설명입니다.
        description: "Get the dependencies and (via npm) cache them."
        runs:
          using: "composite"
          steps:
            # deploy.yml 파일에서 분리할 Step을 붙여넣습니다.
            - name: Cache dependencies
              id: cache
              # uses 키를 사용할 때는 별도의 키를 추가하지 않아도 됩니다.
              uses: actions/cache@v3
              with:
                path: node_modules
                key: deps-node-modules-${{ hashFiles('**/package-lock.json') }}
            # 여전히 작성된 모든 키를 지원하기 때문에 유지 가능합니다.
            - name: Install dependencies
              # 아래 조건문도 여전히 동일하게 수행되어야 하기 때문에 변경사항이 없습니다.
              if: steps.cache.outputs.cache-hit != 'true'
              run: npm ci
              # 커스텀 composite action에서 run을 실행할 때, 반드시 shell 키를 포함해야 합니다.
              shell: bash
    - 참고 - [Custom Action 관련](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#runs-for-composite-actions)

  - Custom Composite Action을 `deploy.yml` 파일에 적용해 봅니다.
    - `./.github/workflows/deploy.yml`
      - ```yml
        name: Deployment
          on:
            push:
              branches:
                - main
          jobs:
            lint:
              runs-on: ubuntu-latest
              steps:
                - name: Get code
                  uses: actions/checkout@v3
                - name: Load & cache dependencies
                  # 독립 레포지토리로 커스텀 액션을 분리하게 되면
                  # 단순히 레포지토리 식별자를 기입하면 됩니다. ex) uses: seongjin2427/my-action
                  # 지금은 동일 프로젝트 내의 커스텀 액션이기 때문에, 루트 폴더 기준 경로를 작성합니다.
                  # GitHub Actions가 자동적으로 action.yml을 바라보기 때문에 기입하지 않습니다.
                  uses: ./.github/actions/cached-deps
                - name: Lint code
                  run: npm run lint
                ...

- Result
  - `./.github/actions/cached-deps/action.yml`로 분리하여 정의한 Custom Action이 정상적으로 동작하는 것을 확인할 수 있습니다.

2. 다른 Job들에서 중복되는 Step들도 교체합니다. - [`f18c37e8`](https://github.com/seongjin2427/09.custom-actions/commit/f18c37e81eac08a0d478a2ffe18fbbfeee76168b)

- Process
  - `./.github/workflows/deploy.yml`
    - ```yml
      ...
        test:
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
            # Composite Action으로 교체      
            - name: Load & cache dependencies
              uses: ./.github/actions/cached-deps
            - name: Test code
              id: run-tests
              run: npm run test
            ...

        build:
          needs: test
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
              # Composite Action으로 교체
            - name: Load & cache dependencies
              uses: ./.github/actions/cached-deps
            - name: Build website
              run: npm run build
            ...
- Result
  - `test`, `build` Job에서도 Composite Action으로 교체하여도 정상적으로 동작하는 것을 확인할 수 있습니다.

3. `cache-deps` Custom Action에 `inputs`을 추가하여 사용 시, 별도의 input 값을 작성, 캐시 여부를 지정할 수 있도록 합니다. - [`3f2df567`](https://github.com/seongjin2427/09.custom-actions/commit/3f2df567b68e65a8b744c6399c503ea665d259e1)

- Process
  - `./.github/actions/cached-deps/action.yml`
    - ```yml
      name: "Get & Cache Dependencies"
      description: "Get the dependencies and (via npm) cache them."
      # Custom Action Type에 상관없이 name과 동일한 레벨에서
      # inputs 키를 지정하여 활용할 수 있습니다.
      inputs:
        # 원하는 input 키 이름을 지정할 수 있습니다.
        caching:
          # 반드시 지정되어야 합니다.
          description: 'Whether to cache dependencies or not.'
          # 반드시 해당 input이 존재해야 하는지 여부를 결정합니다.
          # required: true
          required: false
          # 기본 input 값을 지정할 수 있습니다.
          default: 'true'
      runs:
        using: "composite"
        steps:
          - name: Cache dependencies
            # Custom Action에서 inputs 컨텍스트로 각 input 값에 접근할 수 있습니다.
            # caching input 값이 'true'일 때만 캐싱 Step을 실행합니다.
            if: inputs.caching == 'true'
            id: cache
            uses: actions/cache@v3
            with:
              path: node_modules
              key: deps-node-modules-${{ hashFiles('**/package-lock.json') }}
          - name: Install dependencies
            # 조건 추가: caching input이 'true'가 아닐 때에도 실행되어야 합니다.
            if: steps.cache.outputs.cache-hit != 'true' || inputs.caching != 'true'
            run: npm ci
            shell: bash

- Result
  - `inputs` 지정 및 `Install dependencies` Step의 조건 추가로, `caching` input의 값이 `true`가 아닌 경우에는 캐싱이 일어나지 않습니다.

4. `cache-deps`를 통한 캐싱 여부를 명시적으로 표현하기 위해서 각 Job의 Step 별로 `caching`을 지정합니다. - [`a958ebd4`](https://github.com/seongjin2427/09.custom-actions/commit/a958ebd4cfa40c80a61e01db45594320ba030d0d)

- Process
  - `./.github/workflow/deploy.yml`
    - ```yml
      name: Deployment
      on:
        push:
          branches:
            - main
      jobs:
        lint:
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
            - name: Load & cache depeandencies
              uses: ./.github/actions/cached-deps
              with:
                # 제일 처음 의존성을 설치하는 단계에서
                # 명시적으로 캐싱이 되지 않는다는 것을 표현하기도 하고
                # 의존성을 최초로 설치를 해야 하기 때문에 'caching: false'로 지정합니다.
                caching: false
            - name: Lint code
              run: npm run lint
        test:
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
            - name: Load & cache dependencies
              uses: ./.github/actions/cached-deps
              with:
                # 이후의 Job에서의 Custom Action에서는 'caching: true'로 지정하여
                # 앞전 lint Job에서의 캐시를 활용할 수 있도록 합니다.
                caching: true
            - name: Test code
              id: run-tests
              run: npm run test
              ...
        build:
          needs: test
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
            - name: Load & cache dependencies
              uses: ./.github/actions/cached-deps
              with:
                # 이후의 Job에서의 Custom Action에서는 'caching: true'로 지정하여
                # 앞전 lint Job에서의 캐시를 활용할 수 있도록 합니다.
                caching: true
            - name: Build website
              run: npm run build
              ...

- Result
  - `lint` Job에서 캐싱이 이루어지고, 나머지 다른 Job들에 대해서는 캐싱된 의존성들을 활용하여 워크플로우가 진행됩니다.

5. `cached-deps` Custom Action에 `outputs` 키를 추가하여 내보내고, `deploy.yml` 에서 가져와 출력해 봅니다. - [`0f595470`](https://github.com/seongjin2427/09.custom-actions/commit/0f595470ceb90af82d72465c8eaaf3282dac343a)

- Process
  - `./.github/acitons/cached-deps/action.yml`
    - ```yml
      name: "Get & Cache Dependencies"
      description: "Get the dependencies and (via npm) cache them."
      inputs:
        caching:
          description: 'Whether to cache dependencies or not.'
          required: false
          default: 'true'
      # inputs 키와 동일한 레벨에서 outputs을 지정합니다.
      outputs:
        # 원하는 output 키를 지정할 수 있습니다.
        used-cache:
          # 해당 output의 설명을 작성합니다.
          description: 'Whether the cache was used.'
          # 내보낼 값을 지정합니다.
          # steps 컨텍스트를 사용, step들 중 install Step에서
          # $GITHUB_OUTPUT으로 지정한 값 (cache='${{ inputs.caching }}')을 value로 할당합니다.
          value: ${{ steps.install.outputs.cache }}
      runs:
        using: "composite"
        steps:
          - name: Cache dependencies
            if: inputs.caching == 'true'
            id: cache
            uses: actions/cache@v3
            with:
              path: node_modules
              key: deps-node-modules-${{ hashFiles('**/package-lock.json') }}
          - name: Install dependencies
            # output의 value를 할당할 Step에 id를 지정합니다. (value: steps.install)
            id: install
            if: steps.cache.outputs.cache-hit != 'true' || inputs.caching != 'true'
            # 값을 할당하기 위해 멀티 라인 구문으로 변경합니다.
            run: |
              npm ci
              echo "cache='${{ inputs.caching }}'" >> $GITHUB_OUTPUT
            shell: bash

  - `./.github/workflows/deploy.yml`
    - ```yml
      name: Deployment
      on:
        push:
          branches:
            - main
      jobs:
        lint:
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
            - name: Load & cache dependencies
              # Custom Action의 outputs을 가져올 수 있도록 id를 지정합니다.
              id: cached-deps
              uses: ./.github/actions/cached-deps
              with:
                caching: false
            # 위 cached-deps Custom Action에서 지정한 id로 참조하여
            # 내보내진 outputs 값을 출력합니다.
            - name: Outputs Information
              run: echo "Cache used? ${{ steps.cached-deps.outputs.used-cache }}"
            - name: Lint code
              run: npm run lint
      ...

- Result
  - `lint` Job의 `Outputs Information` Step에서 `false`로 정상적으로 출력됩니다.

<br>

---

## JavaScript Action
- 본 프로젝트를 빌드하여 생성되는 정적페이지를 AWS S3 버켓에 업로드합니다.

1. `./.github/actions` 폴더 하위에 `deploy-s3-javascript` 폴더와 그 하위에 `action.yml` 파일과 `main.js` 파일을 생성하여 정의하고, `workflows/deploy.yml` 파일에 새로운 Job을 추가합니다. - [`4b88c224`](https://github.com/seongjin2427/09.custom-actions/commit/4b88c22469b11633144e0799550ca0ab3c6e0091)

- Process
  - `./.github/actions/deploy-s3-javascript/action.yml`
    - ```yml
      # Custom Action의 이름을 지정합니다.
      name: "Deploy to AWS S3"
      # Custom Action의 설명을 작성합니다.
      description: "Deploy a static website via AWS S3."
      # Custom Action이기 때문에 on 키로 트리거 하는 것이 아닌
      # runs 키로 어떤 방식으로 실행할 지 지정합니다.
      runs: 
        # JavaScript 런타임 환경인 Node의 버전을 지정합니다.
        # 현재 node20이 사용할 수 있는 가장 최신 버전입니다.
        # 
        using: 'node16'
        # JavaScript Action에서 main 키는 필수 입니다.
        # Custom Action이 실행될 때, 실행할 JavaScript 파일의 경로를 지정합니다.
        main: 'main.js'
        # pre, post키를 통해 main에서 지정한 JavaScript 파일을
        # 실행하기 전, 후에 실행할 JavaScript 파일을 지정할 수 있습니다.

  - 터미널에서 `.github/actions/deploy-s3-javascript` 폴더로 이동하여 `npm init -y` 명령어를 실행하여 패키지 설치 환경을 설정합니다.
  - `npm install actions/core actions/github actions/exec` 명령어를 실행하여 JavaScript Action을 실행하기 위한 패키지 3가지를 설치합니다.
    - `actions/core`, `actions/github`, `actions/exec`
  - `./.github/actions/deploy-s3-javascript/main.js`
    - ```js
      // 필요한 패키지 3가지를 가져와서 사용합니다.
      // 지금은 작동 여부를 확실히 하기 위해서 core.notice 메서드만 간단히 활용해 봅니다.
      const core = require("@actions/core");
      const github = require("@actions/github");
      const exec = require("@actions/exec");

      function run() {
        core.notice("Hello from my custom JavaScript Action!");
      }

      run();
  
  - `main.js` 파일이 정상적으로 작동하는지 확인하기 위해, `deploy.yml` 파일에 새로운 Job(`information`)을 추가합니다.
    - ```yml
      ...

      jobs:
        ... 

        # JavaScript Action 실행을 위한 Step을 추가합니다.
        information:
          runs-on: ubuntu-latest
          steps:
            # 기존 코드를 러너에 먼저 다운로드 해야 JavaScript Action도 실행할 수 있습니다.
            - name: Get code
              uses: actions/checkout@v3
            # JavaScript Action을 실행합니다.
            - name: Run custom action
              uses: ./.github/actions/deploy-s3-javascript
  
  - 주의할 것
    - 패키지 설치 후, 생성되는 `node_modules` 폴더는 `.gitignore`의 대상이 되면 안됩니다.
      - JavaScript Action은 별도의 패키지를 설치할 수 없어 함께 레포지토리에 포함되어야 합니다.
    - `dist` 역시 `.gitignore`의 대상이 되면 안됩니다.
      - 위와 동일한 이유로 루트 레벨의 dist 폴더만 무시될 수 있도록 `/dist`으로 대체하여 적용합니다.

  - 참고
    - [`runs` for JavaScript Actions](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions#runs-for-javascript-actions)
    - [Creating a JavaScript action](https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action)
    - [actions/toolkit](https://github.com/actions/toolkit)

- Result
  - 정상적으로 JavaScript Aciton이 실행되는 것을 확인할 수 있습니다.

2. AWS S3 버킷을 생성하고, 각 파일들을 업데이트 합니다. - [`2603c477`](https://github.com/seongjin2427/09.custom-actions/commit/2603c4778e90db88769d1bc8dc3fa208c9d94f6c)
  - 재사용을 위해 `deploy-s3-javascript/action.yml` 파일에 `inputs` 값을 추가합니다.
  - `actions` 패키지를 활용하여 S3와 상호작용 하기 위해 `deploy-s3-javascript/main.js` 파일에 코드를 추가합니다.
  - AWS 보안 자격 증명에서 Access Key ID, Secret Access Key를 생성한 후, 레포지토리 Secrets을 등록합니다.
    - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `workflows/deploy.yml`의 `deploy` Job에 `Deploy site` Step을 업데이트 합니다.

- Process
  - `.github/actions/deploy-s3-javascript/action.yml`
    - ```yml
      # JavaScript Custom Action의 이름을 지정합니다.
      name: "Deploy to AWS S3"
      description: "Deploy a static website via AWS S3."
      # 재사용을 위해 inputs 값을 입력받도록 지정합니다.
      inputs:
        # 업로드 할 AWS S3 버킷 이름을 필수로 입력 받습니다.
        bucket:
          description: "The S3 bucket name."
          required: true
        # 버킷 리전을 지정합니다. (기본값은 서울로 지정했습니다.)
        bucket-region:
          description: "The region of the S3 bucket."
          required: false
          default: "ap-northeast-2"
        # 업로드 할 파일이 존재하는 경로를 입력받습니다.
        dist-folders:
          description: "The folder containing the deployable files."
          required: true
      runs:
        using: "node16"
        main: "main.js"

  - `.github/actions/deploy-s3-javascript/main.js`
    - ```js
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

  - `.github/workflows/deploy.yml`
    - ```yml
      ...
        deploy:
          needs: build
          runs-on: ubuntu-latest
          steps:
            - name: Get code
              uses: actions/checkout@v3
            - name: Get build artifacts
              uses: actions/download-artifact@v3
              with:
                name: dist-files
                path: ./dist
            - name: Output contents
              run: ls
            - name: Deploy site
              # JavaScript Action을 사용하기 위해 경로를 지정합니다.
              uses: ./.github/actions/deploy-s3-javascript
              # AWS S3 CLI를 통해 S3 버킷에 접근하기 위한 Access Key를 secrets으로 지정합니다.
              env:
                AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
                AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
              # JavaScript Action에서 지정한 inputs 값을 지정합니다.
              with:
                bucket: gha-ito-custom-action-hosting
                dist-folder: ./dist

  - 레포지토리 Action Secrets에 AWS의 Access ID와 Secrets Access key를 등록합니다.

- Result
  - AWS S3 버킷에 빌드한 파일이 업로드 된 것을 확인할 수 있고, 호스팅 된 정적 페이지에도 접근이 가능합니다.

3. AWS S3 버킷으로 자동 업로드 후, `outputs`키 값을 사용하여 호스팅 된 웹 사이트 URL을 로그에 출력합니다. - [`c3d9433b`](https://github.com/seongjin2427/09.custom-actions/commit/c3d9433b2da1138c385e32b963ead5fd8c4c5740)

- Process
  - `deploy-s3-javascript/action.yml`
    - ```yml
      name: "Deploy to AWS S3"
      description: "Deploy a static website via AWS S3."
      inputs:
        bucket:
          description: "The S3 bucket name."
          required: true
        bucket-region:
          description: "The region of the S3 bucket."
          required: false
          default: "ap-northeast-2"
        dist-folder:
          description: "The folder containing the deployable files."
          required: true
      # inputs과 같은 레벨에서 outputs 값을 지정합니다.
      outputs:
        # website url을 반환할 키 값을 원하는 대로 지정합니다.
        website-url:
          # Composite Action과 달리 value 키를 여기서 지정하지 않습니다.
          # JavaScript Action의 value는 main.js에서 지정합니다.
          description: "The URL of the deployed website."
      runs:
        using: "node16"
        main: "main.js"

  - `deploy-s3-javascript/main.js`
    - ```js
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

  - `workflows/deploy.yml`
    - ```yml
      ...
          - name: Output contents
            run: ls
          - name: Deploy site
            # output 값을 참조하기 위한 id 값을 지정합니다.
            id: deploy
            uses: ./.github/actions/deploy-s3-javascript
            env:
              AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
              AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
            with:
              bucket: gha-ito-custom-action-hosting
              dist-folder: ./dist
          # Deploy site Step에서 받을 output 값을 id(deploy)를 참조하여 로그로 출력합니다.
          - name: Output information
            run: |
              echo "Live URL: ${{ steps.deploy.outputs.website-url }}"

- Result
  - 출력된 웹 사이트 URL을 클릭하면 해당 프로젝트의 정적 페이지로 접속됩니다.

<br>

---

## Docker Action

1. 예제에서 주어지는 python 코드를 기반으로, 앞전 JavaScript Action 동작과 동일한 Docker Action을 실행해봅니다. - 
  - `.github/actions/deploy-s3-docker` 폴더를 생성합니다.
  - 폴더 하위에 `action.yml`, `deployment.py`, `Dockerfile`, `requirements.txt`를 정의합니다.
  - `.github/workflows/deploy.yml` 일부를 업데이트 합니다.

- Process
  - `action.yml`
    - ```yml
      name: "Deploy to AWS S3"
      description: "Deploy a static website via AWS S3"
      inputs:
        bucket:
          description: "The S3 bucket name."
          required: true
        bucket-region:
          description: "The region of the S3 bucket."
          required: false
          default: "ap-northeast-2"
        dist-folder:
          description: "The folder containing the deployable files."
          required: true
      outputs:
        website-url:
          description: "The URL of the deployed website."
      runs:
        # JavaScript Action 대비 using과 image 키만 다릅니다.
        using: "docker"
        image: "Dockerfile"
  
  - `deployment.py`
    - python 코드를 해석하기는 어렵지만, 대략적으로 JavaScript Action과 거의 유사하게 동작한다는 것을 확인할 수 있습니다.
    - ```py
      import os
      import boto3
      import mimetypes
      from botocore.config import Config


      def run():
          bucket = os.environ['INPUT_BUCKET']
          bucket_region = os.environ['INPUT_BUCKET-REGION']
          dist_folder = os.environ['INPUT_DIST-FOLDER']

          configuration = Config(region_name=bucket_region)

          s3_client = boto3.client('s3', config=configuration)

          for root, subdirs, files in os.walk(dist_folder):
              for file in files:
                  s3_client.upload_file(
                      os.path.join(root, file),
                      bucket,
                      os.path.join(root, file).replace(dist_folder + '/', ''),
                      ExtraArgs={"ContentType": mimetypes.guess_type(file)[0]}
                  )

          website_url = f'http://{bucket}.s3-website-{bucket_region}.amazonaws.com'
          with open(os.environ['GITHUB_OUTPUT'], 'a') as gh_output:
              print(f'website-url={website_url}', file=gh_output)


      if __name__ == '__main__':
          run()
  - `Dockerfile`
    - ```Dockerfile
      FROM python:3

      COPY requirements.txt /requirements.txt

      RUN pip install -r requirements.txt

      COPY deployment.py /deployment.py

      CMD ["python", "/deployment.py"]

  - `requirements.txt`
    - ```text
      boto3==1.24.71
      botocore==1.27.71
      jmespath==1.0.1
      python-dateutil==2.8.2
      s3transfer==0.6.0
      six==1.16.0
      urllib3==1.26.12

  - `workflows/deploy.yml`
    - ```yml
      ...
          - name: Deploy site
            id: deploy
            # uses: ./.github/actions/deploy-s3-javascript
            # javascript -> docker
            uses: ./.github/actions/deploy-s3-docker
            env:
              AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
              AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
            with:
              bucket: gha-ito-custom-action-hosting
              dist-folder: ./dist
          - name: Output information
            run: |
              echo "Live URL: ${{ steps.deploy.outputs.website-url }}"

- Result
  - 