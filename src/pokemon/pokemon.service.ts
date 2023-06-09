import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreatePokemonDto } from './dto/create-pokemon.dto';
import { UpdatePokemonDto } from './dto/update-pokemon.dto';
import { Pokemon } from './entities/pokemon.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PokemonService {
  private defaultLimit: number;
  constructor(
    //Inyectar modelos en el servicio
    @InjectModel(Pokemon.name)
    private readonly pokemonModel: Model<Pokemon>,
    private readonly configService: ConfigService,
  ) {
    this.defaultLimit = configService.get('defaultLimit');
  }

  async create(createPokemonDto: CreatePokemonDto) {
    createPokemonDto.name = createPokemonDto.name.toLowerCase();
    try {
      const pokemon = await this.pokemonModel.create(createPokemonDto);
      return pokemon;
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async findAll({ limit = this.defaultLimit, offset = 0 }: PaginationDto) {
    return await this.pokemonModel
      .find()
      .limit(limit)
      .skip(offset)
      .select('-__v') //le quita la columna que quieras
      .sort({ no: 1 }); //Ordena la columna no de manera ascendente
  }

  async findOne(term: string): Promise<Pokemon> {
    let pokemon: Pokemon;
    //No
    if (!isNaN(+term)) {
      pokemon = await this.pokemonModel.findOne({ no: term }).select('-__v');
    }
    //MongoID
    if (!pokemon && isValidObjectId(term)) {
      pokemon = await this.pokemonModel.findById(term);
    }
    //Name
    if (!pokemon) {
      pokemon = await this.pokemonModel.findOne({
        name: term.toLowerCase().trim(),
      });
    }

    if (!pokemon)
      throw new NotFoundException(
        `Pokemon with id, name or no ${term} not found`,
      );
    return pokemon;
  }

  async update(term: string, updatePokemonDto: UpdatePokemonDto) {
    const pokemon = await this.findOne(term);
    if (updatePokemonDto.name)
      updatePokemonDto.name = updatePokemonDto.name.toLowerCase();
    try {
      await pokemon.updateOne(updatePokemonDto);
      return { ...pokemon.toJSON(), ...updatePokemonDto };
    } catch (error) {
      this.handleExceptions(error);
    }
  }

  async remove(term: string) {
    // const pokemon = await this.findOne(term);
    // await pokemon.deleteOne(); //este metodo lo borra pero con 2 consultas
    const { deletedCount } = await this.pokemonModel.deleteOne({ _id: term });
    if (deletedCount === 0)
      throw new BadRequestException(`Pokemon with id ${term} not found`);
  }

  private handleExceptions(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(
        `Pokemon exists in db ${JSON.stringify(error.keyValue)}`,
      );
    }
    console.log(error);
    throw new InternalServerErrorException(
      `Can't crete Pokemon - Check server logs`,
    );
  }
}
