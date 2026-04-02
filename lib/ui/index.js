import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp, Spacer } from "ink";
import SelectInput from "ink-select-input";
import Spinner from "ink-spinner";
import htm from "htm";
import { pluginManager } from "../plugin-manager.js";
import prettyBytes from "pretty-bytes";
import chalk from "chalk";

const html = htm.bind(React.createElement);

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_HEIGHT = 5;
const FOOTER_HEIGHT = 3;

// ─── Components ───────────────────────────────────────────────────────────────

const Header = ({ totalSize }) => html`
  <${Box} 
    height=${HEADER_HEIGHT} 
    borderStyle="round" 
    borderColor="cyan" 
    paddingX=${1} 
    flexDirection="column"
    justifyContent="center"
  ><${Box}><${Text} bold color="cyan">🧹 devmop </${Text}><${Text} color="gray">| Terminal Dashboard</${Text}></${Box}><${Box}><${Text}>Total potentially recoverable: </${Text}><${Text} bold color="yellow">${prettyBytes(totalSize)}</${Text}></${Box}></${Box}>
`;

const Sidebar = ({ plugins, onSelect }) => {
  const items = plugins.map(p => ({
    label: p.name.charAt(0).toUpperCase() + p.name.slice(1),
    value: p.name,
    size: p.size || 0
  }));

  return html`
    <${Box} 
      width="30%" 
      borderStyle="round" 
      paddingX=${1} 
      flexDirection="column"
    ><${Text} bold underline marginBottom=${1}>Plugins</${Text}><${SelectInput} 
        items=${items} 
        onSelect=${onSelect}
        itemComponent=${({ label, isSelected, item }) => html`
          <${Box}><${Text} color=${isSelected ? "cyan" : "white"}>${isSelected ? "❯ " : "  "}${label.padEnd(10)}</${Text}><${Text} color="gray"> [${prettyBytes(item ? item.size : 0)}]</${Text}></${Box}>
        `}
      /></${Box}>
  `;
};

const MainArea = ({ plugin, isCleaning }) => {
  if (!plugin) return html`<${Box} flexGrow=${1} justifyContent="center" alignItems="center"><${Text} color="gray">Select a plugin to see details</${Text}></${Box}>`;

  const barWidth = 30;
  const percentage = 100; 
  const filledChars = Math.floor((barWidth * percentage) / 100);
  const bar = "█".repeat(filledChars).padEnd(barWidth, "░");

  return html`
    <${Box} 
      flexGrow=${1} 
      borderStyle="round" 
      paddingX=${2} 
      flexDirection="column"
    ><${Box} marginBottom=${1}><${Text} bold color="cyan">${plugin.name.toUpperCase()} </${Text}><${Text} color="gray">— ${plugin.description}</${Text}></${Box}><${Box} flexDirection="column" marginBottom=${1}><${Text}>Estimated Size: <${Text} bold color="yellow">${prettyBytes(plugin.size || 0)}</${Text}></${Text}><${Text} color="cyan">${bar}</${Text}></${Box}><${Box} flexGrow=${1} flexDirection="column"><${Text} color="gray" italic>Paths to scan:</${Text}><${Box} flexDirection="column" marginTop=${1}><${Text}>• Caches and temporary logs</${Text}><${Text}>• Build artifacts (if applicable)</${Text}></${Box}></${Box}><${Box} borderStyle="single" borderColor="gray" paddingX=${1} justifyContent="center">${isCleaning 
          ? html`<${Text}><${Spinner} type="dots" /> Cleaning ${plugin.name}...</${Text}>`
          : html`<${Text}>Press <${Text} bold color="green">C</Text> to clean this plugin</${Text}>`
        }</${Box}></${Box}>
  `;
};

const Footer = () => html`
  <${Box} 
    height=${FOOTER_HEIGHT} 
    borderStyle="single" 
    borderColor="gray" 
    paddingX=${1} 
    alignItems="center"
  ><${Box} marginRight=${2}><${Text} bold color="gray">KEYS: </${Text}></${Box}><${Box} marginRight=${2}><${Text} color="cyan">↑/↓</${Text}><${Text} color="gray"> Navigate</${Text}></${Box}><${Box} marginRight=${2}><${Text} color="green">C</Text><${Text} color="gray"> Clean Selected</${Text}></${Box}><${Box} marginRight=${2}><${Text} color="yellow">A</${Text}><${Text} color="gray"> Clean All</${Text}></${Box}><${Spacer} /><${Box}><${Text} color="red">Q</Text><${Text} color="gray"> Quit</${Text}></${Box}></${Box}>
`;

const App = () => {
  const { exit } = useApp();
  const [plugins, setPlugins] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCleaning, setIsCleaning] = useState(false);
  const [totalSize, setTotalSize] = useState(0);

  // Initial Scan
  useEffect(() => {
    async function scan() {
      const all = pluginManager.getAllPlugins();
      let total = 0;
      const updated = [];
      
      for (const p of all) {
        const size = await p.getSize();
        updated.push({ 
          name: p.name, 
          description: p.description, 
          size,
          plugin: p // Keep reference to original plugin instance
        });
        total += size;
      }
      
      setPlugins(updated);
      setTotalSize(total);
    }
    scan();
  }, []);

  useInput(async (input, key) => {
    if (input === "q") exit();
    
    if (input === "c" && !isCleaning) {
      const pluginData = plugins[selectedIndex];
      if (pluginData) {
        setIsCleaning(true);
        await pluginData.plugin.clean({ dry: false });
        // Refresh size
        const newSize = await pluginData.plugin.getSize();
        const nextPlugins = [...plugins];
        nextPlugins[selectedIndex].size = newSize;
        setPlugins(nextPlugins);
        setTotalSize(nextPlugins.reduce((a, b) => a + (b.size || 0), 0));
        setIsCleaning(false);
      }
    }

    if (input === "a" && !isCleaning) {
      setIsCleaning(true);
      const all = pluginManager.getAllPlugins();
      for (const p of all) {
        await p.clean({ dry: false });
      }
      // Re-scan all
      const updated = [];
      let total = 0;
      for (const p of all) {
        const size = await p.getSize();
        updated.push({ 
          name: p.name, 
          description: p.description, 
          size,
          plugin: p 
        });
        total += size;
      }
      setPlugins(updated);
      setTotalSize(total);
      setIsCleaning(false);
    }
  });

  return html`
    <${Box} flexDirection="column" height="100%" width="100%" padding=${1}>
      <${Header} totalSize=${totalSize} />
      
      <${Box} flexGrow=${1} marginY=${1}>
        <${Sidebar} 
          plugins=${plugins} 
          onSelect=${(item) => {
            const idx = plugins.findIndex(p => p.name === item.value);
            setSelectedIndex(idx);
          }} 
        />
        <${MainArea} 
          plugin=${plugins[selectedIndex]} 
          isCleaning=${isCleaning} 
        />
      </${Box}>

      <${Footer} />
    </${Box}>
  `;
};

// ─── Entry Point ──────────────────────────────────────────────────────────────

export function startDashboard() {
  // Use alternate screen buffer
  process.stdout.write("\u001b[?1049h");
  
  const { waitUntilExit } = render(React.createElement(App));
  
  waitUntilExit().then(() => {
    // Back to normal buffer
    process.stdout.write("\u001b[?1049l");
    process.exit(0);
  });
}
