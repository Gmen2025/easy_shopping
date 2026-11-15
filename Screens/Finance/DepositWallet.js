import React, { useRef, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as Crypto from "expo-crypto";
import {
  financeError,
  financeMoney,
  financeRequest,
  operatorRequest,
} from "../../assets/common/finance";

export default function DepositWallet({
  wallet,
  account,
  path,
  admin,
  reload,
}) {
  const [policy, setPolicy] = useState(account.depositPolicy);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [depositedAt, setDepositedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const request = useRef(null);
  const enabled = wallet.enabled && account.depositPolicy.enabled;
  const money = (value) => financeMoney(value, wallet.currency);
  const key = (signature) => {
    if (request.current?.signature !== signature)
      request.current = { signature, key: Crypto.randomUUID() };
    return request.current.key;
  };
  const run = async (action) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(
        "Deposit action failed",
        `${financeError(error)} Refresh income to recover saved deposits before submitting another.`,
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const confirm = (title, body, action) =>
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => run(action) },
    ]);
  const send = (url, data, method = "post") =>
    financeRequest(url, { method, data });
  const open = async (url) => {
    if (!/^https:\/\//.test(url || ""))
      throw new Error("The gateway did not return a secure payment link.");
    await Linking.openURL(url);
  };
  const value = () => {
    const parsed = Number(amount);
    if (
      !amount.trim() ||
      !Number.isFinite(parsed) ||
      parsed <= 0 ||
      !Number.isSafeInteger(Math.round(parsed * 100)) ||
      Math.abs(parsed * 100 - Math.round(parsed * 100)) > 1e-7
    )
      throw new Error("Enter a positive amount with at most two decimals.");
    return parsed;
  };
  const button = (label, onPress, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={[styles.button, (disabled || busy) && styles.disabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
  const input = (label, text, update, numeric = false) => (
    <View>
      <Text>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={String(text)}
        onChangeText={update}
        editable={!busy}
        keyboardType={numeric ? "decimal-pad" : "default"}
      />
    </View>
  );
  const verify = async (entry, approved) => {
    await send(
      `${path}/wallet/deposits/${entry._id}/verify`,
      entry.method === "bank"
        ? {
            action: approved ? "approve" : "reject",
            confirmedReceived: approved,
          }
        : {},
    );
    await reload();
    Alert.alert(
      "Deposit verified",
      "Only confirmed funds increase your balance.",
    );
  };
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Prepaid cash-fee deposit balance</Text>
      <Text style={styles.balance}>{money(wallet.balance)}</Text>
      <Text>
        Regional requirement {wallet.enabled ? "ON" : "OFF"} / Account
        requirement {account.depositPolicy.enabled ? "ON" : "OFF"}
      </Text>
      <Text style={styles.note}>
        Separate from earnings and payouts. Only confirmed cash/off-platform
        fees use this balance. Online-paid transactions do not. Company income
        remains company-owned.
      </Text>
      {wallet.state === "blocked" && (
        <Text accessibilityRole="alert" style={styles.error}>
          Top up to resume new work. Active work can finish; Admin suspensions
          remain.
        </Text>
      )}
      {wallet.state === "low" && (
        <Text accessibilityRole="alert" style={styles.error}>
          Low deposit balance. Replenish soon to avoid interruption.
        </Text>
      )}
      <Text>
        Warn at {money(account.depositPolicy.lowBalance)}; block new work at or
        below {money(account.depositPolicy.minimumBalance)} when enabled.
      </Text>
      {admin && (
        <>
          {button(
            `${wallet.enabled ? "Turn OFF" : "Turn ON"} regional cash deposit requirement`,
            () =>
              confirm(
                "Change regional deposit requirement?",
                "Applies to ALL drivers and stores in this region. Turning it off pauses top-ups, cash-fee deductions and deposit blocking. Existing payments can still be verified.",
                async () => {
                  await send(
                    "wallet-config",
                    { enabled: !wallet.enabled },
                    "put",
                  );
                  await reload();
                },
              ),
          )}
          <View style={styles.toggle}>
            <Text>
              Require this account's deposit (including company accounts)
            </Text>
            <Switch
              disabled={busy}
              value={policy.enabled}
              onValueChange={(enabled) => setPolicy({ ...policy, enabled })}
            />
          </View>
          {input(
            "Low-balance warning",
            policy.lowBalance,
            (lowBalance) => setPolicy({ ...policy, lowBalance }),
            true,
          )}
          {input(
            "Minimum balance",
            policy.minimumBalance,
            (minimumBalance) => setPolicy({ ...policy, minimumBalance }),
            true,
          )}
          {button("Save account deposit settings", () =>
            run(async () => {
              if (
                String(policy.lowBalance).trim() === "" ||
                String(policy.minimumBalance).trim() === ""
              )
                throw new Error("Complete both balance thresholds.");
              await send(
                `${path}/wallet/settings`,
                {
                  enabled: policy.enabled,
                  lowBalance: Number(policy.lowBalance),
                  minimumBalance: Number(policy.minimumBalance),
                },
                "put",
              );
              await reload();
            }),
          )}
        </>
      )}
      <Text style={styles.heading}>Deposit with the company</Text>
      {wallet.bankAccounts.map((bank) => (
        <Text key={bank._id}>
          {bank.bankName}: {bank.accountNumber} / {bank.accountHolderName} (
          {wallet.currency})
        </Text>
      ))}
      {!wallet.bankAccounts.length && (
        <Text>Contact Admin for verified company deposit instructions.</Text>
      )}
      {input(`Deposit amount (${wallet.currency})`, amount, setAmount, true)}
      <Picker
        accessibilityLabel="Deposit method"
        enabled={!busy && enabled}
        selectedValue={method}
        onValueChange={setMethod}
      >
        <Picker.Item
          label="Bank / company receipt (Admin verification)"
          value="bank"
        />
        {wallet.methods.card && (
          <Picker.Item label="Card (verified gateway)" value="card" />
        )}
        {wallet.methods.telebirr && (
          <Picker.Item label="Telebirr (verified gateway)" value="telebirr" />
        )}
      </Picker>
      {method === "bank" && (
        <>
          {input(
            "Transfer / company receipt reference",
            reference,
            setReference,
          )}
          {input(
            "Actual deposit local date/time (YYYY-MM-DDTHH:mm)",
            depositedAt,
            setDepositedAt,
          )}
        </>
      )}
      {button(
        "Submit deposit / open payment",
        () =>
          run(async () => {
            const amount = value();
            let date;
            if (method === "bank") {
              if (
                !reference.trim() ||
                !depositedAt.trim() ||
                !Number.isFinite(new Date(depositedAt).getTime())
              )
                throw new Error(
                  "Enter the real reference and valid deposit date/time.",
                );
              date = new Date(depositedAt).toISOString();
            }
            const result = await send(`${path}/wallet/deposits`, {
              amount,
              currency: wallet.currency,
              method,
              reference,
              depositedAt: date,
              requestKey: key(
                `deposit:${amount}:${method}:${reference}:${depositedAt}`,
              ),
            });
            request.current = null;
            setAmount("");
            await reload();
            if (result.paymentUrl) await open(result.paymentUrl);
            else
              Alert.alert(
                "Deposit saved",
                "Admin must verify the actual funds before your balance is credited.",
              );
          }),
        !enabled || !wallet.methods[method],
      )}
      {admin && (
        <>
          <Text style={styles.heading}>Additional cash/off-platform fee</Text>
          <Text>
            Use the amount above. Offline transactions not recorded on the
            platform require an itemized Admin charge. Never charge online-paid
            fees again.
          </Text>
          {input("Fee reason / offline transaction reference", notes, setNotes)}
          {button(
            "Record additional fee",
            () =>
              confirm(
                "Deduct this itemized fee?",
                "The fee will reduce this account's prepaid deposit balance.",
                async () => {
                  const amount = value();
                  await send(`${path}/wallet/charges`, {
                    amount,
                    notes,
                    requestKey: key(`charge:${amount}:${notes}`),
                  });
                  request.current = null;
                  setAmount("");
                  setNotes("");
                  await reload();
                },
              ),
            !enabled,
          )}
        </>
      )}
      <Text style={styles.heading}>Deposit & fee history (latest 100)</Text>
      {wallet.transactions.map((entry) => (
        <View style={styles.entry} key={entry._id}>
          <Text>
            {entry.type === "fee" ? "-" : "+"}
            {money(entry.amountMinor / 100)} / {entry.type} / {entry.status}
          </Text>
          <Text>
            Requested/recorded: {new Date(entry.createdAt).toLocaleString()}
          </Text>
          {entry.depositedAt && (
            <Text>
              Deposited: {new Date(entry.depositedAt).toLocaleString()}
            </Text>
          )}
          {entry.verifiedAt && (
            <Text>Verified: {new Date(entry.verifiedAt).toLocaleString()}</Text>
          )}
          {entry.balanceAfterMinor !== undefined && (
            <Text>Balance after: {money(entry.balanceAfterMinor / 100)}</Text>
          )}
          <Text>
            {entry.reference} {entry.notes}
          </Text>
          {entry.type === "deposit" &&
            !["completed", "failed"].includes(entry.status) &&
            (entry.method === "bank" ? (
              admin && (
                <>
                  {button("Confirm received & credit", () =>
                    confirm(
                      "Confirm deposited funds?",
                      `${money(entry.amountMinor / 100)} / ${entry.reference}. Confirm the company actually received the funds.`,
                      () => verify(entry, true),
                    ),
                  )}
                  {button("Reject claim", () =>
                    confirm(
                      "Reject deposit?",
                      "No funds will be credited.",
                      () => verify(entry, false),
                    ),
                  )}
                </>
              )
            ) : (
              <>
                {button("Verify gateway payment", () =>
                  run(() => verify(entry)),
                )}
                {(entry.paymentUrl || entry.status === "pending") &&
                  button("Open saved payment", () =>
                    run(async () => {
                      const result = await send(
                        `${path}/wallet/deposits/${entry._id}/start`,
                        {},
                      );
                      await reload();
                      if (result.paymentUrl) await open(result.paymentUrl);
                    }),
                  )}
              </>
            ))}
        </View>
      ))}
      {wallet.legacyTransactions.length > 0 && (
        <Text style={styles.heading}>Historical driver wallet records</Text>
      )}
      {wallet.legacyTransactions.map((entry) => (
        <View key={entry._id} style={styles.entry}>
          <Text>
            {entry.type}: {money(entry.amount)} / {entry.status} /{" "}
            {new Date(entry.createdAt).toLocaleString()} / {entry.reference}
          </Text>
          {admin &&
            entry.type === "deposit" &&
            entry.status === "pending" &&
            button("Verify legacy deposit", () =>
              confirm(
                "Confirm legacy deposit received?",
                `${money(entry.amount)} / ${entry.reference}`,
                async () => {
                  await operatorRequest(
                    `drivers/wallet/deposit-requests/${entry._id}/approve`,
                    { method: "put", data: { confirmedReceived: true } },
                  );
                  await reload();
                },
              ),
            )}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 16,
    marginVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  heading: { fontSize: 18, fontWeight: "700", marginTop: 12 },
  balance: { fontSize: 24, fontWeight: "700" },
  note: { marginVertical: 8 },
  error: { color: "#b91c1c", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 6,
    padding: 10,
    marginVertical: 6,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  button: {
    padding: 12,
    backgroundColor: "#2563eb",
    borderRadius: 6,
    marginVertical: 4,
  },
  buttonText: { color: "#fff", textAlign: "center" },
  disabled: { opacity: 0.45 },
  entry: {
    borderTopWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
    gap: 4,
  },
});
