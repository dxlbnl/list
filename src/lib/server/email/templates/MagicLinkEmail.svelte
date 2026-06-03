<script lang="ts">
	import {
		Body,
		Container,
		Head,
		Heading,
		Html,
		Link,
		Preview,
		Text,
		Hr,
	} from "svelte-email";

	let { url, type = "login" } = $props();

	const title = $derived(
		type === "secure" ? "Secure Your Account" : "Sign in to Lists",
	);
	const description = $derived(
		type === "secure"
			? "Click the link below to verify your email and secure your anonymous session. This will ensure you never lose access to your lists."
			: "Click the link below to sign in to your account. No password required.",
	);
</script>

<Html lang="en">
	<Head />
	<Body style="background-color: #0a0a0a; color: #e0e0e0; font-family: 'Inter', system-ui, sans-serif; padding: 40px 20px;">
		<Preview preview={title} />
		<Container style="margin: 0 auto; width: 500px;">
			<Text style="color: #3b82f6; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
				PROTOCOL_AUTH_V1
			</Text>
			
			<Heading style="color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -1px; margin: 12px 0 24px 0;">
				{title}
			</Heading>
			
			<Text style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
				{description}
			</Text>
			
			<Link
				href={url}
				style="background-color: #3b82f6; border-radius: 4px; color: #ffffff; display: inline-block; font-family: monospace; font-size: 14px; font-weight: 700; letter-spacing: 1px; padding: 16px 32px; text-decoration: none; text-transform: uppercase;"
			>
				EXECUTE_LOGIN_SEQUENCE
			</Link>
			
			<Text style="color: #606060; font-family: monospace; font-size: 12px; margin-top: 40px;">
				Link expires in 15 minutes.
			</Text>
			
			<Hr style="border: 0; border-top: 1px solid #2a2a2a; margin: 32px 0;" />
			
			<Text style="color: #404040; font-family: monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;">
				SYSTEM_GEN_MSG // NO_REPLY
			</Text>
		</Container>
	</Body>
</Html>
