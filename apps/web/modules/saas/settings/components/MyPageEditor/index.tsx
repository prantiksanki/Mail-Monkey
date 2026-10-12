"use client";

import { BookingBlock } from "./BookingBlock";
import { DesignPanel } from "./DesignPanel";
import { LinksBlock, newContactFormRow, newLinkRow } from "./LinksBlock";
import { LinksHeader } from "./LinksHeader";
import { MyPageShell } from "./MyPageShell";
import { ProfileBlock } from "./ProfileBlock";
import { SectionCard } from "./SectionCard";
import type { Platform } from "./types";
import { useMyPageState } from "./useMyPageState";

export function MyPageProfilePage() {
	const state = useMyPageState();
	const { blocks, updateBlock, getBlock, reloadSession } = state;
	const profileBlock = getBlock(blocks, "profile");

	return (
		<MyPageShell state={state}>
			<SectionCard
				title="Profile"
				enabled={profileBlock.enabled}
				onToggleEnabled={(enabled) =>
					updateBlock(profileBlock.id, { enabled })
				}
			>
				<ProfileBlock
					data={profileBlock.data}
					onChange={(data) => {
						if (data.username !== profileBlock.data.username) {
							reloadSession();
						}
						updateBlock(profileBlock.id, { data });
					}}
				/>
			</SectionCard>
		</MyPageShell>
	);
}

export function MyPageLinksPage() {
	const state = useMyPageState();
	const { blocks, updateBlock, getBlock } = state;
	const linksBlock = getBlock(blocks, "links");
	const profileBlock = getBlock(blocks, "profile");
	const links = linksBlock.data;

	const setLinks = (data: typeof links) =>
		updateBlock(linksBlock.id, { data });

	return (
		<MyPageShell state={state}>
			<LinksHeader
				profile={profileBlock.data}
				onChangeBio={(bio) =>
					updateBlock(profileBlock.id, {
						data: { ...profileBlock.data, bio },
					})
				}
				onAddLink={(platform: Platform = "custom") =>
					setLinks([...links, newLinkRow(platform, links)])
				}
				onAddContactForm={() =>
					setLinks([...links, newContactFormRow(links)])
				}
			/>
			<LinksBlock links={links} onChange={setLinks} />
		</MyPageShell>
	);
}

export function MyPageBookingPage() {
	const state = useMyPageState();
	const { blocks, updateBlock, getBlock } = state;
	const bookingBlock = getBlock(blocks, "booking");

	return (
		<MyPageShell state={state}>
			<SectionCard
				title="Booking"
				enabled={bookingBlock.enabled}
				onToggleEnabled={(enabled) =>
					updateBlock(bookingBlock.id, { enabled })
				}
			>
				<BookingBlock
					data={bookingBlock.data}
					onChange={(data) => updateBlock(bookingBlock.id, { data })}
				/>
			</SectionCard>
		</MyPageShell>
	);
}

export function MyPageDesignPage() {
	const state = useMyPageState();
	const { design, setDesign } = state;

	return (
		<MyPageShell state={state}>
			<SectionCard title="Design">
				<DesignPanel data={design} onChange={setDesign} />
			</SectionCard>
		</MyPageShell>
	);
}
