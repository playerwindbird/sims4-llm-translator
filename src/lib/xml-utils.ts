export interface ParsedItem {
    id: string;
    source: string;
    dest: string;
}

export interface ParsedData {
    items: ParsedItem[];
}

/**
 * Parses the Sims 4 translation XML content.
 * Expected structure:
 * <STBLXMLResources>
 *   <Content>
 *     <Table>
 *       <String id="...">
 *         <Source>...</Source>
 *         <Dest>...</Dest>
 *       </String>
 *     </Table>
 *   </Content>
 * </STBLXMLResources>
 */
export async function parseXML(fileContent: string): Promise<ParsedData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, "text/xml");

    const errorNode = xmlDoc.querySelector("parsererror");
    if (errorNode) {
        throw new Error("Failed to parse XML: " + errorNode.textContent);
    }

    const items: ParsedItem[] = [];
    const stringNodes = xmlDoc.getElementsByTagName("String");

    for (let i = 0; i < stringNodes.length; i++) {
        const node = stringNodes[i];
        const id = node.getAttribute("id");
        const sourceNode = node.querySelector("Source");
        const destNode = node.querySelector("Dest");

        if (id && sourceNode && destNode) {
            items.push({
                id,
                source: sourceNode.textContent || "",
                dest: destNode.textContent || "",
            });
        }
    }

    return { items };
}

/**
 * Generates the translated XML by replacing Dest tags in the original content.
 * Preserves the original formatting.
 */
export function generateXML(
    originalXML: string,
    translations: Record<string, string>
): string {
    let resultXML = originalXML;

    for (const [id, translation] of Object.entries(translations)) {
        // Regex to find the <String id="ID"> ... <Dest>OLD</Dest> ... </String> block
        // We target the Dest tag specifically associated with the ID
        // Note: This regex assumes the standard structure found in the example.
        // It looks for the String tag with the ID, then any content until <Dest>, captures content, then </Dest>

        // Pattern explanation:
        // (<String[^>]*id=["']${id}["'][^>]*>[\s\S]*?<Dest>) matches everything from <String id=...> to <Dest>
        // ([\s\S]*?) matches the content inside <Dest> (non-greedy)
        // (<\/Dest>) matches the closing tag

        const regex = new RegExp(
            `(<String[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<Dest>)([\\s\\S]*?)(<\\/Dest>)`,
            "g"
        );

        // Replace the content inside <Dest>...</Dest> with the new translation
        // We use a function to replacement to avoid issues with special patterns in the replacement string
        resultXML = resultXML.replace(regex, (_, prefix, _oldContent, suffix) => {
            return `${prefix}${translation}${suffix}`;
        });
    }

    return resultXML;
}
