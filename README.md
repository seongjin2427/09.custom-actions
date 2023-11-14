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

## Composite Actions

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

5. `cached-deps` Custom Action에 `outputs` 키를 추가하여 내보내고, `deploy.yml` 에서 가져와 출력해 봅니다. - 

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
  - 