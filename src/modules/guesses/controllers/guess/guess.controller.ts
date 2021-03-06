import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { BaseController } from "../../../../models/base-controller";
import { UserService } from "../../../shared/services/user-service/user.service";
import { Request, Response } from "express";
import { UserModel } from "../../../../database/models/user.model";
import { AuthGuard } from "../../../../guards/auth-guard/auth.guard";
import { UpdateGuessDto } from "../../../../models/request/update-guess";
import { ServerMessagesGateway } from "../../../shared/gateways/server-messages.gateway";

@Controller("guess")
export class GuessController extends BaseController {
  constructor(
    private readonly service: UserService,
    private readonly serverMessagesGateway: ServerMessagesGateway,
  ) {
    super();
  }

  @UseGuards(AuthGuard)
  @Get()
  public async getUserGuesses(@Req() request: Request, @Res() response: Response) {    
    const userId = request.headers.from;

    // Get the user from the database
    let dbUser: UserModel;
    try {
      dbUser = await this.service.getById(userId);
    } catch (e) {
      console.error(e);
      this.sendNotFoundResponse(response, "User not found");
      return;
    }

    // Retrieve the user's guesses.
    const guesses = dbUser.guesses;

    // Order the guesses by only retrieve the title
    const orderedGuesses = guesses
      .sort((a, b) => a.guessedPosition - b.guessedPosition)
      .map(guess => guess.songTitle);

    while (orderedGuesses.length < 10) {
      // if at least 10 haven't been set then return minimum ten.
      orderedGuesses.push("");
    }

    // Return the guess titles
    return this.sendOkResponse(response, { guesses: orderedGuesses });
  }

  @UseGuards(AuthGuard)
  @Post()
  public async updateUserGuesses(@Req() request: Request, @Res() response: Response, @Body() dto: UpdateGuessDto) {
    // Check that the guess entry is still open
    const lockStatus = process.env.GUESS_LOCK_STATUS;

    if (lockStatus === "locked") {
      // Entry has been locked
      this.sendBadRequestResponse(response, "Too Late M8, You're stuck with what you picked");
      return;
    }
    
    const userId = request.headers.from;

    // Get the user from the database
    let dbUser: UserModel;
    try {
      dbUser = await this.service.getById(userId);
    } catch (e) {
      console.error(e);
      this.sendNotFoundResponse(response, "User not found");
      return;
    }

    // Update the user's guesses with the provided ones
    dbUser.guesses = dto.guesses.map((title, i) => ({ songTitle: title ?? "", guessedPosition: i + 1 }));
    await dbUser.save();

    this.serverMessagesGateway.notifyDataUpdate();

    // Return nothing
    return this.sendNoContentResponse(response);
  }
}
