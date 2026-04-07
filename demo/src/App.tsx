import React, { useState } from 'react';
import BasicTab from './tabs/BasicTab';
import StylesTab from './tabs/StylesTab';
import MarkersTab from './tabs/MarkersTab';
import ControlledTab from './tabs/ControlledTab';
import ResponsiveTab from './tabs/ResponsiveTab';
import AdvancedTab from './tabs/AdvancedTab';

type TabId =
	| 'basic'
	| 'styles'
	| 'markers'
	| 'controlled'
	| 'responsive'
	| 'advanced';

const TABS: { id: TabId; label: string }[] = [
	{ id: 'basic', label: 'Basic' },
	{ id: 'styles', label: 'Styles' },
	{ id: 'markers', label: 'Markers' },
	{ id: 'controlled', label: 'Controlled' },
	{ id: 'responsive', label: 'Responsive' },
	{ id: 'advanced', label: 'Advanced' },
];

function getInitialTab(): TabId {
	const params = new URLSearchParams(window.location.search);
	const tab = params.get('tab') as TabId | null;
	return tab && TABS.some((t) => t.id === tab) ? tab : 'basic';
}

export default function App() {
	const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

	const handleTabChange = (id: TabId) => {
		setActiveTab(id);
		const url = new URL(window.location.href);
		url.searchParams.set('tab', id);
		window.history.replaceState(null, '', url.toString());
		(window as any).__waveformReady = false;
	};

	return (
		<div>
			<header
				style={{
					borderBottom: '1px solid #e5e7eb',
					paddingBottom: 16,
					marginBottom: 0,
				}}
			>
				<h1 style={{ margin: '0 0 4px' }}>waveform-navigator</h1>
				<p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
					Interactive component demo — select a tab to explore each feature in
					isolation.
				</p>
			</header>

			<nav className="tab-nav" role="tablist" aria-label="Demo sections">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						role="tab"
						aria-selected={activeTab === tab.id}
						aria-controls={'panel-' + tab.id}
						id={'tab-' + tab.id}
						className={
							'tab-button' + (activeTab === tab.id ? ' tab-button--active' : '')
						}
						onClick={() => handleTabChange(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</nav>

			<main
				id={'panel-' + activeTab}
				role="tabpanel"
				aria-labelledby={'tab-' + activeTab}
				className="tab-panel"
			>
				{activeTab === 'basic' && <BasicTab />}
				{activeTab === 'styles' && <StylesTab />}
				{activeTab === 'markers' && <MarkersTab />}
				{activeTab === 'controlled' && <ControlledTab />}
				{activeTab === 'responsive' && <ResponsiveTab />}
				{activeTab === 'advanced' && <AdvancedTab />}
			</main>
		</div>
	);
}
