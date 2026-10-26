// The BRASA manual requires Lato for every heading containing the brand name,
// including text changed by the CMS preview or published content.
export function applyHeadingTypography(root=document) {
 const headings=[...(root.matches?.('h1,h2,h3,h4,h5,h6')?[root]:[]),...root.querySelectorAll('h1,h2,h3,h4,h5,h6')];
 for(const heading of headings)heading.classList.toggle('brand-heading',/\bBRASA\b/i.test(heading.textContent));
}
