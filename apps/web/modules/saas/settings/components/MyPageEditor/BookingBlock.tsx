"use client";

import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { Textarea } from "@repo/ui/components/textarea";

import { type BookingData, DAY_KEYS, type DayWindow } from "./types";

const DEFAULT_WINDOW: NonNullable<DayWindow> = {
	startTime: "09:00",
	endTime: "17:00",
};

export function BookingBlock({
	data,
	onChange,
}: {
	data: BookingData;
	onChange: (data: BookingData) => void;
}) {
	const setDay = (dayIndex: number, window: DayWindow) => {
		onChange({ ...data, days: { ...data.days, [dayIndex]: window } });
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				{DAY_KEYS.map((label, dayIndex) => {
					const window = data.days[dayIndex] ?? null;
					return (
						<div key={label} className="flex items-center gap-3">
							<Switch
								checked={!!window}
								onCheckedChange={(checked) =>
									setDay(
										dayIndex,
										checked ? DEFAULT_WINDOW : null,
									)
								}
							/>
							<span className="w-9 text-sm">{label}</span>
							{window ? (
								<div className="flex items-center gap-2">
									<Input
										type="time"
										value={window.startTime}
										onChange={(e) =>
											setDay(dayIndex, {
												...window,
												startTime: e.target.value,
											})
										}
										className="h-8 w-28 text-sm"
									/>
									<span className="text-foreground/40">
										–
									</span>
									<Input
										type="time"
										value={window.endTime}
										onChange={(e) =>
											setDay(dayIndex, {
												...window,
												endTime: e.target.value,
											})
										}
										className="h-8 w-28 text-sm"
									/>
								</div>
							) : (
								<span className="text-foreground/40 text-sm">
									Unavailable
								</span>
							)}
						</div>
					);
				})}
			</div>

			<div>
				<p className="mb-1.5 font-medium text-sm">
					What should visitors know before booking?
				</p>
				<Textarea
					value={data.note}
					onChange={(e) =>
						onChange({ ...data, note: e.target.value })
					}
					placeholder="e.g. Please include your project details in the booking notes."
					rows={3}
				/>
			</div>
		</div>
	);
}
