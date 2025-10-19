import { defineDocumentType, makeSource } from "contentlayer/source-files";

export const Page = defineDocumentType(() => ({
  name: "Page",
  filePathPattern: `pages/**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    description: { type: "string" },
    heroImage: { type: "string" },
    draft: { type: "boolean", default: false },
    order: { type: "number", default: 0 }
  },
  computedFields: {
    slug: {
      type: "string",
      resolve: (doc) => doc._raw.flattenedPath.replace(/^pages\//, "")
    },
    sortOrder: {
      type: "number",
      resolve: (doc) => {
        const rawOrder = doc.order as unknown;
        if (typeof rawOrder === "number" && Number.isFinite(rawOrder)) {
          return rawOrder;
        }
        if (typeof rawOrder === "string") {
          const parsedFromString = Number.parseFloat(rawOrder.trim());
          return Number.isFinite(parsedFromString) ? parsedFromString : 0;
        }
        const parsed = Number.parseFloat(String(rawOrder ?? "").trim());
        return Number.isFinite(parsed) ? parsed : 0;
      }
    }
  }
}));

export const Service = defineDocumentType(() => ({
  name: "Service",
  filePathPattern: `services/**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    short: { type: "string" },
    heroImage: { type: "string" },
    faq: { type: "list", of: { type: "string" } }
  },
  computedFields: {
    slug: {
      type: "string",
      resolve: (doc) => doc._raw.flattenedPath.replace(/^services\//, "")
    }
  }
}));

export const Area = defineDocumentType(() => ({
  name: "Area",
  filePathPattern: `areas/**/*.mdx`,
  contentType: "mdx",
  fields: {
    title: { type: "string", required: true },
    city: { type: "string" },
    county: { type: "string" },
    description: { type: "string" }
  },
  computedFields: {
    slug: {
      type: "string",
      resolve: (doc) => doc._raw.flattenedPath.replace(/^areas\//, "")
    }
  }
}));

export default makeSource({
  contentDirPath: "content",
  documentTypes: [Page, Service, Area]
});
