---
date: 2024-07-04T00:00:00-00:00
draft: true

title: Template Post
weight: 10
cover:
  image: template_cover.png
  alt: "<alt text>"
  caption: "<text>"
  relative: true # To use relative path for cover image, used in hugo Page-bundles
tags: ["Template",]
---
# My Blog Post

Here is an introductory paragraph with some **bold** text and some *italic* text.
And here's a footnote[^1]!

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

## Standard Formatting
This is ~~strikethrough~~ text.

This is *italic* text.
This is _italic_ text.

This is **bold** text.
This is __bold__ text.

## Lists
### Unordered
- Item 1
- Item 2
  - Subitem 1
  - Subitem 2
- Item 3

### Ordered
1. First item
2. Second item
   1. Subitem 1
   2. Subitem 2
3. Third item

## Quotes

Here is a block quote:
> "This is a block quote."

Another one:
> This is a block quote.
> 
> It can span multiple lines.

## Code
### Code Blocks

Here is a code block:
```python
print("Hello, world!")
```

### In line Code
Here is some `inline code`.

## Tables

| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

## Rules

---


## Links to Things

## Sites
Visit the [Hugo](https://gohugo.io) website!

## YouTube
Embed a youtube video:
{{<youtube c5VGu9iypuc>}}

## Images
Embed a picture:
![Description of the image](template_image.png)

## Other Fun Shortcodes
### Figures
And here is an image:
{{< figure src="template_image.png" caption="This is a caption." >}}

### GitHub Gists
Here is a GitHub Gist:
{{< gist mikeornstein d2318fe0fefe82b6fba8f2d7e032bbda >}}

### Let's chat
{{< chat-left >}}
Hello! How can I help you today?
{{< /chat-left >}}

{{< chat-right >}}
I have a question about my order.
{{< /chat-right >}}

{{< chat-left >}}
Sure, I'd be happy to help. What's your order number? What if this is a really long line with a lot of text and potentially some *markdown*
Like really fancy markdown in it!? `print("hello world")`
{{< /chat-left >}}

{{< chat-right >}}
It's #12345.
{{< /chat-right >}}

[^1]: look ma, a footnote!