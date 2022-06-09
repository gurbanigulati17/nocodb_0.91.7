---
title: "Share Base"
description: "Procedure to share a base & generating embedded iframe"
position: 615
category: "Product"
menuTitle: "Share Base"
---

## Generate `Share base`

- Open Project 
- Click on `Share` button on top right tool bar

![image](https://user-images.githubusercontent.com/35857179/161957411-ee9ec53d-4745-43c3-99f2-600cb20923e7.png)

- Under `Shared base link` tab and toggle from `Disabled Share base` to `Anyone with the link`

![Screenshot 2022-02-19 at 11 16 02 AM](https://user-images.githubusercontent.com/86527202/154789352-87e65fcc-fbe5-48f0-a1e1-e54dce91a1f3.png)

- Share base link generated is displayed over & can be used to share this project to others in the team [Selection (2) in the image below]

![Screenshot 2022-02-19 at 12 01 58 PM](https://user-images.githubusercontent.com/86527202/154789725-a1194e30-3101-423a-bd5c-25009c361b96.png)

## Modify `Share base`

Modifying `Share base` will invalidate the `Share base` link generated previously and will generate a new link.

-   Open Project base
-   Click on 'Share' button on top right tool bar
-   Click on 'Reload' button on Quick menu (next to Shared base link)

## Disable `Share base`

Disabling `Share base` will invalidate the generated `Share base` link

-   Open Project base
-   Click on 'Share' button on top right tool bar
-   Under `Shared base link` and toggle from `Anyone with the link` to `Disable Share base`

## `Share base` Access Permissions

Shared base can be configured as

-   Viewer - User with the link will get **READ ONLY** access to the project data.
-   Editor - User with the link will get **READ & WRITE** access to the project data.

## Embeddable Frame

NocoDB interface can be embedded into existing applications easily by making use of [HTML IFRAME](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)) attribute.

### Generate embeddable HTML code

-   Open Project base
-   Click on 'Share' button on top right tool bar
-   Under 'Shared base link' tab
    -   Click on </> button to copy 'Embeddable HTML code'

Example:

```html
<iframe
    class="nc-embed"
    src="https://nocodb-nocodb-rsyir.ondigitalocean.app/dashboard/#/nc/base/e3bba9df-4fc1-4d11-b7ce-41c4a3ad6810?embed"
    frameborder="0"
    width="100%"
    height="700"
    style="background: transparent; border: 1px solid #ddd"
>
</iframe>
```

### Embed into application's HTML Body

Sample code with embedded iframe generated above

```html
<!DOCTYPE html>
<html>
    <body>
        <iframe
            class="nc-embed"
            src="http://localhost:3000/#/nc/base/7d4b551c-b5e0-41c9-a87b-f3984c21d2c7?embed"
            frameborder="0"
            width="100%"
            height="700"
            style="background: transparent; "
        ></iframe>
    </body>
</html>
```
