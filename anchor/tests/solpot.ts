import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";
import { createHash } from "crypto";

// IDL type will be generated after `anchor build`
// import { Solpot } from "../target/types/solpot";

describe("solpot", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Solpot as Program<any>;
  const authority = provider.wallet as anchor.Wallet;

  const ENTRY_FEE = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
  const FEE_BPS = 250; // 2.5%
  const SECRET_WORD = "solana";
  const WORD_HASH = createHash("sha256").update(SECRET_WORD).digest();

  const MPL_CORE_PROGRAM_ID = new PublicKey(
    "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
  );

  // Derive PDAs
  const [gameConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("game_config")],
    program.programId
  );

  const [leaderboardPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("leaderboard"), gameConfigPda.toBuffer()],
    program.programId
  );

  let roundPda: PublicKey;
  let roundBump: number;

  it("Initializes the game", async () => {
    const tx = await program.methods
      .initializeGame(ENTRY_FEE, FEE_BPS)
      .accountsStrict({
        gameConfig: gameConfigPda,
        leaderboard: leaderboardPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize game tx:", tx);

    const gameConfig = await (program.account as any).gameConfig.fetch(gameConfigPda);
    expect(gameConfig.authority.toBase58()).to.equal(
      authority.publicKey.toBase58()
    );
    expect(gameConfig.roundCount.toNumber()).to.equal(0);
    expect(gameConfig.entryFeeLamports.toNumber()).to.equal(
      ENTRY_FEE.toNumber()
    );
    expect(gameConfig.feeBasisPoints).to.equal(FEE_BPS);
  });

  it("Creates a round", async () => {
    const roundId = new anchor.BN(0);
    [roundPda, roundBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("round"),
        gameConfigPda.toBuffer(),
        roundId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const tx = await program.methods
      .createRound(
        Array.from(WORD_HASH) as number[],
        10, // max_players
        new anchor.BN(3600) // 1 hour duration
      )
      .accountsStrict({
        gameConfig: gameConfigPda,
        round: roundPda,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Create round tx:", tx);

    const round = await (program.account as any).round.fetch(roundPda);
    expect(round.id.toNumber()).to.equal(0);
    expect(round.isActive).to.be.true;
    expect(round.hasWinner).to.be.false;
    expect(round.playerCount).to.equal(0);
  });

  it("Player enters the round", async () => {
    // Airdrop SOL to a test player
    const player = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      player.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const [playerEntryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_entry"),
        roundPda.toBuffer(),
        player.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tx = await program.methods
      .enterRound()
      .accountsStrict({
        gameConfig: gameConfigPda,
        round: roundPda,
        playerEntry: playerEntryPda,
        player: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    console.log("Enter round tx:", tx);

    const round = await (program.account as any).round.fetch(roundPda);
    expect(round.playerCount).to.equal(1);
    expect(round.potLamports.toNumber()).to.equal(ENTRY_FEE.toNumber());
  });

  it("Player submits incorrect guess", async () => {
    const player = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      player.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const [playerEntryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_entry"),
        roundPda.toBuffer(),
        player.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Enter round first
    await program.methods
      .enterRound()
      .accountsStrict({
        gameConfig: gameConfigPda,
        round: roundPda,
        playerEntry: playerEntryPda,
        player: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    // Submit wrong guess
    const tx = await program.methods
      .submitGuess("ethereum")
      .accountsStrict({
        round: roundPda,
        playerEntry: playerEntryPda,
        player: player.publicKey,
      })
      .signers([player])
      .rpc();

    console.log("Wrong guess tx:", tx);

    const round = await (program.account as any).round.fetch(roundPda);
    expect(round.hasWinner).to.be.false;
    expect(round.isActive).to.be.true;
  });

  it("Player submits correct guess and wins", async () => {
    const player = Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      player.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const [playerEntryPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player_entry"),
        roundPda.toBuffer(),
        player.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Enter
    await program.methods
      .enterRound()
      .accountsStrict({
        gameConfig: gameConfigPda,
        round: roundPda,
        playerEntry: playerEntryPda,
        player: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    // Correct guess
    const tx = await program.methods
      .submitGuess(SECRET_WORD)
      .accountsStrict({
        round: roundPda,
        playerEntry: playerEntryPda,
        player: player.publicKey,
      })
      .signers([player])
      .rpc();

    console.log("Correct guess tx:", tx);

    const round = await (program.account as any).round.fetch(roundPda);
    expect(round.hasWinner).to.be.true;
    expect(round.isActive).to.be.false;
    expect(round.winner.toBase58()).to.equal(player.publicKey.toBase58());

    // Distribute pot
    const distributeTx = await program.methods
      .distributePot()
      .accountsStrict({
        gameConfig: gameConfigPda,
        round: roundPda,
        winner: player.publicKey,
        feeReceiver: authority.publicKey,
        leaderboard: leaderboardPda,
      })
      .rpc();

    console.log("Distribute pot tx:", distributeTx);

    const roundAfter = await (program.account as any).round.fetch(roundPda);
    expect(roundAfter.potDistributed).to.be.true;
    expect(roundAfter.potLamports.toNumber()).to.equal(0);

    // Mint NFT reward using Metaplex Core
    const assetKeypair = Keypair.generate();

    const mintTx = await program.methods
      .mintRewardNft(
        "SolPot Winner #0",
        "https://arweave.net/solpot-winner-0"
      )
      .accountsStrict({
        gameConfig: gameConfigPda,
        round: roundPda,
        asset: assetKeypair.publicKey,
        winner: player.publicKey,
        payer: authority.publicKey,
        mplCoreProgram: MPL_CORE_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([assetKeypair])
      .rpc();

    console.log("Mint NFT tx:", mintTx);

    const roundFinal = await (program.account as any).round.fetch(roundPda);
    expect(roundFinal.nftMinted).to.be.true;
  });
});
