---
description: How to deploy updates to the live Firebase website
---

Whenever you make changes to the code (e.g., editing `BullshitPoker.jsx`), the live website at `https://bullshitpoker-8e193.web.app` will **not** update automatically. You must manually build and upload the new version.

### Steps to Deploy

1.  **Build the Project**:
    This converts your code into the final "static" files that the browser can read.

    ```bash
    npm run build
    ```

2.  **Deploy to Firebase**:
    This uploads the new files from the `dist` folder to Google's servers.
    ```bash
    firebase deploy
    ```

### Workflow Shortcut

You can run both commands in one line:

```bash
npm run build && firebase deploy
```

// turbo
