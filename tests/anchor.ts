import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BN, web3 } from "@project-serum/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { QuickTacToe } from "../target/types/quick_tac_toe";
import type { Errors } from "../target/types/errors";

// const pg = anchor.AnchorProvider.local();
// anchor.setProvider(pg);

const program = anchor.workspace.QuickTacToe as Program<QuickTacToe>;

type Square = { row: number; column: number };
type Status = { active: {} } | { won: {} } | { tie: {} } | { notStarted: {} };
type Board = ({ x: {} } | { o: {} } | null)[][];
interface PlayArgs {
  square: Square;
  player: web3.Keypair;
  playerRecord: web3.PublicKey;
  otherPlayerRecord: web3.PublicKey;
  game: web3.PublicKey;
  expectedTurn: number;
  expectedState: Status;
  expectedBoard: Board;
  winner?: web3.PublicKey;
}

function numberBuffer(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = Number(value & BigInt(0xff));
    value = value >> BigInt(8);
  }
  return bytes;
}

async function play({
  square,
  player,
  playerRecord,
  otherPlayerRecord,
  game,
  expectedTurn,
  expectedState,
  expectedBoard,
  winner,
}: PlayArgs): Promise<void> {
  try {
    const txHash = await program.methods
      .play(square)
      .accounts({
        player: player.publicKey,
        playerRecord,
        otherPlayerRecord,
        game,
      })
      .signers([player])
      .rpc();
    await program.provider.connection.confirmTransaction(txHash);

    const gameData = await program.account.game.fetch(game);
    assert.strictEqual(
      gameData.turn,
      expectedTurn,
      `Turn should be ${expectedTurn}`
    );
    assert.deepEqual(gameData.state, expectedState, "State does not match");
    assert.deepEqual(gameData.board, expectedBoard, "Board does not match");
    if (winner) {
      assert.strictEqual(
        gameData.winner.toBase58(),
        player.publicKey.toBase58(),
        "Expect Player O to be in Player O position"
      );
    }
  } catch (err) {
    console.log(err);
  }
}

describe("Quick-Tac-Toe", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Errors as anchor.Program<Errors>;
  
  const [mint] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("play_token_mint")],
    program.programId
  );
  const [programState] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
    program.programId
  );

  const playerXKp = new web3.Keypair();
  const playerOKp = new web3.Keypair();

  const [playerXPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player"), playerXKp.publicKey.toBuffer()],
    program.programId
  );
  const [playerOPda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player"), playerOKp.publicKey.toBuffer()],
    program.programId
  );

  const playerXAta = getAssociatedTokenAddressSync(mint, playerXKp.publicKey);
  const playerOAta = getAssociatedTokenAddressSync(mint, playerOKp.publicKey);

  const GAME_ID = 1;

  const [game] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("new_game"), numberBuffer(BigInt(GAME_ID))],
    program.programId
  );

  before(async () => {
    const [drop1, drop2] = await Promise.all([
      program.provider.connection.requestAirdrop(playerXKp.publicKey, web3.LAMPORTS_PER_SOL),
      program.provider.connection.requestAirdrop(playerOKp.publicKey, web3.LAMPORTS_PER_SOL),
    ]);
    await Promise.all([
      program.provider.connection.confirmTransaction(drop1),
      program.provider.connection.confirmTransaction(drop2),
    ]);
  });

  it("1. Initialize mint", async () => {
    try {
      const txHash = await program.methods
        .init()
        .accounts({
          mint,
          programState,
          payer: program.provider.publicKey,
        })
        .signers([])
        .rpc({ skipPreflight: true });

      await program.provider.connection.confirmTransaction(txHash, "finalized");

      const tokenSupply = await program.provider.connection.getTokenSupply(mint);
      assert.strictEqual(
        tokenSupply.value.uiAmount,
        0,
        "Initial token supply should be 0"
      );
    } catch (error) {
      assert.fail(`Error in transaction: ${error}`);
    }
  });

  it("2. Create players", async () => {
    try {
      const ixPlayerX = await program.methods
        .createPlayer()
        .accounts({
          player: playerXKp.publicKey,
          playerPda: playerXPda,
          playerTokenAccount: playerXAta,
          mint,
        })
        .instruction();
      const ixPlayerO = await program.methods
        .createPlayer()
        .accounts({
          player: playerOKp.publicKey,
          playerPda: playerOPda,
          playerTokenAccount: playerOAta,
          mint,
        })
        .instruction();
      const tx = new web3.Transaction().add(ixPlayerX, ixPlayerO);
      const txHash = await web3.sendAndConfirmTransaction(
        program.provider.connection,
        tx,
        [playerXKp, playerOKp],
        { skipPreflight: false, commitment: "finalized" }
      );

      const [playerXData, playerOData] = await Promise.all([
        program.account.player.fetch(playerXPda),
        program.account.player.fetch(playerOPda),
      ]);
      assert.strictEqual(
        playerXData.record.wins,
        0,
        "Should have record with 0 wins."
      );
      assert.strictEqual(
        playerXData.record.losses,
        0,
        "Should have record with 0 losses."
      );
      assert.strictEqual(
        playerXData.record.ties,
        0,
        "Should have record with 0 ties."
      );
      assert.strictEqual(
        playerOData.record.wins,
        0,
        "Should have record with 0 wins."
      );
      assert.strictEqual(
        playerOData.record.losses,
        0,
        "Should have record with 0 losses."
      );
      assert.strictEqual(
        playerOData.record.ties,
        0,
        "Should have record with 0 ties."
      );

      const [playerXTokenBalance, playerOTokenBalance] = await Promise.all([
        program.provider.connection.getTokenAccountBalance(playerXAta),
        program.provider.connection.getTokenAccountBalance(playerOAta),
      ]);

      assert.strictEqual(
        playerXTokenBalance.value.uiAmount,
        10,
        "Should have received 10 Tokens."
      );
      assert.strictEqual(
        playerOTokenBalance.value.uiAmount,
        10,
        "Should have received 10 Tokens."
      );
    } catch (error) {
      assert.fail(`Error in transaction: ${error}`);
    }
  });

  it("3. Create game", async () => {
    try {
      const txHash = await program.methods
        .createGame(new BN(GAME_ID))
        .accounts({
          game,
          playerX: playerXKp.publicKey,
          playerPda: playerXPda,
          mint,
          playerTokenAccount: playerXAta,
          programState,
        })
        .signers([playerXKp])
        .rpc({ skipPreflight: true });

      await program.provider.connection.confirmTransaction(txHash, "finalized");

      const gameData = await program.account.game.fetch(game);

      assert.strictEqual(gameData.turn, 0, "Turn should be 0");
      assert.strictEqual(gameData.id.toNumber(), GAME_ID, "ID Should be 1.");
      assert.strictEqual(
        gameData.playerX.toBase58(),
        playerXKp.publicKey.toBase58(),
        "Expect Player X to be in Player X position"
      );

      assert.deepEqual(
        gameData.state,
        { notStarted: {} },
        "State should be not started"
      );
      assert.deepEqual(
        gameData.board,
        [
          [null, null, null],
          [null, null, null],
          [null, null, null],
        ],
        "Board should be empty"
      );
    } catch (error) {
      assert.fail(`Error in transaction: ${error}`);
    }
  });

  it("4. Cannot join own game", async () => {
    let didThrow = false;
    try {
      const txHash = await program.methods
        .joinGame()
        .accounts({
          game,
          playerO: playerXPda,
          playerPda: playerXPda,
          mint,
          playerTokenAccount: playerXAta,
        })
        .signers([playerXKp])
        .rpc({ skipPreflight: true });

      await program.provider.connection.confirmTransaction(txHash, "finalized");
    } catch (error) {
      didThrow = true;
    } finally {
      assert(didThrow, "Transaction should have thrown an error but didn't.");
    }
  });

  it("5. Player O joins game", async () => {
    try {
      const txHash = await program.methods
        .joinGame()
        .accounts({
          game,
          playerO: playerOKp.publicKey,
          playerPda: playerOPda,
          mint,
          playerTokenAccount: playerOAta,
        })
        .signers([playerOKp])
        .rpc({ skipPreflight: true });

      await program.provider.connection.confirmTransaction(txHash, "finalized");

      const gameData = await program.account.game.fetch(game);

      assert.strictEqual(gameData.turn, 1, "Turn should be 1");
      assert.strictEqual(gameData.id.toNumber(), GAME_ID, "ID Should be 1.");
      assert.strictEqual(
        gameData.playerO.toBase58(),
        playerOKp.publicKey.toBase58(),
        "Expect Player O to be in Player O position"
      );
      assert.deepEqual(
        gameData.state,
        { active: {} },
        "State should be active"
      );
    } catch (error) {
      assert.fail(`Error in transaction: ${error}`);
    }
  });

  it("6. Player X wins game", async () => {
    try {
      await play({
        square: { row: 0, column: 0 },
        player: playerXKp,
        playerRecord: playerXPda,
        otherPlayerRecord: playerOPda,
        game,
        expectedTurn: 2,
        expectedState: { active: {} },
        expectedBoard: [
          [{ x: {} }, null, null],
          [null, null, null],
          [null, null, null],
        ],
      });
      await play({
        square: { row: 0, column: 1 },
        player: playerOKp,
        playerRecord: playerOPda,
        otherPlayerRecord: playerXPda,
        game,
        expectedTurn: 3,
        expectedState: { active: {} },
        expectedBoard: [
          [{ x: {} }, { o: {} }, null],
          [null, null, null],
          [null, null, null],
        ],
      });
      await play({
        square: { row: 1, column: 0 },
        player: playerXKp,
        playerRecord: playerXPda,
        otherPlayerRecord: playerOPda,
        game,
        expectedTurn: 4,
        expectedState: { active: {} },
        expectedBoard: [
          [{ x: {} }, { o: {} }, null],
          [{ x: {} }, null, null],
          [null, null, null],
        ],
      });
      await play({
        square: { row: 1, column: 1 },
        player: playerOKp,
        playerRecord: playerOPda,
        otherPlayerRecord: playerXPda,
        game,
        expectedTurn: 5,
        expectedState: { active: {} },
        expectedBoard: [
          [{ x: {} }, { o: {} }, null],
          [{ x: {} }, { o: {} }, null],
          [null, null, null],
        ],
      });
      await play({
        square: { row: 2, column: 0 },
        player: playerXKp,
        playerRecord: playerXPda,
        otherPlayerRecord: playerOPda,
        game,
        expectedTurn: 5, // Since game is over - turn won't increment
        expectedState: { won: {} },
        expectedBoard: [
          [{ x: {} }, { o: {} }, null],
          [{ x: {} }, { o: {} }, null],
          [{ x: {} }, null, null],
        ],
        winner: playerXKp.publicKey,
      });
    } catch (error) {
      assert.fail(`Error in transaction: ${error}`);
    }
  });

  it("7. Claims reward", async () => {
    const mintKeypair = new web3.Keypair();

    const [metadataAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [editionAddress] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mintKeypair.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const associatedTokenAccountAddress = getAssociatedTokenAddressSync(
      mintKeypair.publicKey,
      playerXKp.publicKey
    );

    try {
      const txHash = await program.methods
        .claimReward()
        .accounts({
          player: playerXKp.publicKey,
          playerPda: playerXPda,
          metadataAccount: metadataAddress,
          editionAccount: editionAddress,
          mintAccount: mintKeypair.publicKey,
          associatedTokenAccount: associatedTokenAccountAddress,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        })
        .signers([playerXKp, mintKeypair])
        .rpc({ skipPreflight: true });

      await program.provider.connection.confirmTransaction(txHash);
      const playerData = await program.account.player.fetch(playerXPda);
      assert(playerData.rewardClaimed, "Reward should be claimed.");
    } catch (error) {
      assert.fail(`Error in transaction: ${error}`);
    }
  });
});
