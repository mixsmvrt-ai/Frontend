"use client";
import { useEffect, useRef, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { authHeaders } from "@/services/api";

type PayPalFundingSource = "paypal" | "card";

declare global {
	interface Window {
		paypal?: {
			FUNDING: { PAYPAL: PayPalFundingSource; CARD: PayPalFundingSource };
			Buttons: (config: {
				fundingSource?: PayPalFundingSource;
				style?: { color?: "gold" | "black" | "blue" | "white" | "silver"; shape?: "rect" | "pill"; height?: number; layout?: "vertical" | "horizontal"; label?: "paypal" | "checkout" | "pay" | "buynow"; tagline?: boolean };
				createOrder: () => Promise<string>;
				onApprove: (data: { orderID: string }) => Promise<void>;
				onError: (error?: unknown) => void;
				onCancel: () => void;
			}) => { isEligible?: () => boolean; render: (element: HTMLDivElement) => Promise<void> | void };
		};
	}
}

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function paypalScriptUrl(clientId: string) {
	return `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons&enable-funding=card&disable-funding=venmo,paylater`;
}

export function PayPalCheckout({ mode = "upgrade", plan = "plus" }: { mode?: "upgrade" | "renew"; plan?: "go" | "plus" }) {
	const buttonTarget = useRef<HTMLDivElement>(null);
	const [fundingSource, setFundingSource] = useState<PayPalFundingSource>("card");
	const [error, setError] = useState("");

	useEffect(() => {
		const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
		if (!clientId || !buttonTarget.current) {
			setError("PayPal checkout is unavailable for this environment.");
			return;
		}

		let cancelled = false;

		const createOrder = async () => {
			const headers = await authHeaders();
			const endpoint = mode === "renew" ? "/membership/renew" : "/membership/upgrade";
			const response = await fetch(`${api}${endpoint}`, { method: "POST", headers, credentials: "include", body: JSON.stringify({ plan }) });
			const payload = await response.json();
			if (!response.ok) throw new Error(payload.error ?? "Unable to create order.");
			return payload.data.orderId as string;
		};

		const captureOrder = async (orderID: string) => {
			const headers = await authHeaders();
			const response = await fetch(`${api}/paypal/capture-order/${orderID}`, { method: "POST", headers, credentials: "include" });
			const payload = await response.json();
			if (!response.ok) {
				toast.error(payload.error ?? "Payment capture failed.");
				return;
			}
			toast.success(mode === "renew" ? "Payment successful. Your Pro Pass has been renewed." : "Payment successful. Your Pro Pass is active.");
			window.location.assign("/billing/success");
		};

		const handleError = (reason?: unknown) => {
			setError("");
			toast.error(reason instanceof Error ? reason.message : "PayPal could not complete this payment.");
		};

		const renderButtons = () => {
			if (!window.paypal || cancelled || !buttonTarget.current) return;

			buttonTarget.current.innerHTML = "";
			const button = window.paypal.Buttons({
				fundingSource: fundingSource === "paypal" ? window.paypal.FUNDING.PAYPAL : window.paypal.FUNDING.CARD,
				style: { color: fundingSource === "paypal" ? "gold" : "black", shape: "rect", height: 48, layout: "vertical", label: fundingSource === "paypal" ? "paypal" : "pay", tagline: false },
				createOrder,
				onApprove: async ({ orderID }) => captureOrder(orderID),
				onError: handleError,
				onCancel: () => window.location.assign("/billing/cancelled"),
			});

			if (button.isEligible?.() !== false) {
				void button.render(buttonTarget.current);
			}
		};

		const existingScript = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk="midiflow"]');
		if (existingScript) {
			if (window.paypal) renderButtons();
			else existingScript.addEventListener("load", renderButtons, { once: true });
			return () => {
				cancelled = true;
			};
		}

		const script = document.createElement("script");
		script.dataset.paypalSdk = "midiflow";
		script.src = paypalScriptUrl(clientId);
		script.async = true;
		script.onload = renderButtons;
		script.onerror = () => setError("PayPal checkout failed to load.");
		document.head.appendChild(script);

		return () => {
			cancelled = true;
		};
	}, [fundingSource, mode, plan]);

	if (error) {
		return <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
	}

	return (
		<div className="rounded-2xl border border-white/10 bg-[#151a29] p-4 shadow-[0_20px_55px_rgba(3,7,18,.3)]">
			<div className="flex items-center justify-between gap-4">
				<div>
					<p className="text-sm font-semibold text-white">Payment method</p>
					<p className="mt-1 text-xs text-[#9ca4b8]">Secure checkout powered by PayPal</p>
				</div>
				<span className="text-xs text-[#9ca4b8]">Step 2 of 2</span>
			</div>
			<div className="mt-4 grid grid-cols-2 gap-3">
				<button type="button" onClick={() => setFundingSource("card")} className={`rounded-xl border p-3 text-left transition ${fundingSource === "card" ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/[.03] hover:border-white/25"}`} aria-pressed={fundingSource === "card"}>
					<span className="flex items-center gap-2 text-sm font-semibold text-white"><span className="grid size-6 place-items-center rounded-md bg-white/10"><CreditCard className="size-3.5" /></span>Debit / credit card</span>
					<span className="mt-1 block text-xs text-[#9ca4b8]">Pay securely with PayPal</span>
				</button>
				<button type="button" onClick={() => setFundingSource("paypal")} className={`rounded-xl border p-3 text-left transition ${fundingSource === "paypal" ? "border-violet-400 bg-violet-500/10" : "border-white/10 bg-white/[.03] hover:border-white/25"}`} aria-pressed={fundingSource === "paypal"}>
					<span className="flex items-center gap-2 text-sm font-semibold text-white"><span className="grid size-6 place-items-center rounded-md bg-[#147bd1] text-xs font-black italic">P</span>PayPal</span>
					<span className="mt-1 block text-xs text-[#9ca4b8]">Log in to PayPal</span>
				</button>
			</div>
			<div className="mt-4 rounded-xl border border-white/10 bg-[#202636] p-3" ref={buttonTarget} />
			<p className="mt-3 text-center text-xs text-[#9ca4b8]">Your payment details are handled securely by PayPal.</p>
		</div>
	);
}
