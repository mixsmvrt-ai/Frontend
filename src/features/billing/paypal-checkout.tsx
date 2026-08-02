"use client";
import { useEffect, useRef, useState } from "react";
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

export function PayPalCheckout({ mode = "upgrade" }: { mode?: "upgrade" | "renew" }) {
	const paypalTarget = useRef<HTMLDivElement>(null);
	const cardTarget = useRef<HTMLDivElement>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
		if (!clientId || !paypalTarget.current || !cardTarget.current) {
			setError("PayPal checkout is unavailable for this environment.");
			return;
		}

		let cancelled = false;

		const createOrder = async () => {
			const headers = await authHeaders();
			const endpoint = mode === "renew" ? "/membership/renew" : "/membership/upgrade";
			const response = await fetch(`${api}${endpoint}`, { method: "POST", headers, credentials: "include" });
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
			if (!window.paypal || cancelled || !paypalTarget.current || !cardTarget.current) return;

			paypalTarget.current.innerHTML = "";
			cardTarget.current.innerHTML = "";

			const paypalButton = window.paypal.Buttons({
				fundingSource: window.paypal.FUNDING.PAYPAL,
				style: { color: "gold", shape: "rect", height: 44, layout: "vertical", label: "paypal", tagline: false },
				createOrder,
				onApprove: async ({ orderID }) => captureOrder(orderID),
				onError: handleError,
				onCancel: () => window.location.assign("/billing/cancelled"),
			});

			const cardButton = window.paypal.Buttons({
				fundingSource: window.paypal.FUNDING.CARD,
				style: { color: "black", shape: "rect", height: 48, layout: "vertical", label: "pay", tagline: false },
				createOrder,
				onApprove: async ({ orderID }) => captureOrder(orderID),
				onError: handleError,
				onCancel: () => window.location.assign("/billing/cancelled"),
			});

			if (paypalButton.isEligible?.() !== false) {
				void paypalButton.render(paypalTarget.current);
			}

			if (cardButton.isEligible?.() !== false) {
				void cardButton.render(cardTarget.current);
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
	}, [mode]);

	if (error) {
		return <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>;
	}

	return (
		<div className="rounded-[28px] border border-white/10 bg-[#1f1f1f] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,.03)]">
			<div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#262626] p-3">
				<div ref={paypalTarget} />
				<div className="mt-3" ref={cardTarget} />
			</div>
			<p className="mt-3 text-center text-xs text-[#aaa3bd]">Choose PayPal or pay by debit or credit card through PayPal&apos;s secure checkout.</p>
		</div>
	);
}
